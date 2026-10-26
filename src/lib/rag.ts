
export type RagChunk = {
  id: string;
  source: string;
  text: string;
  chunkIndex: number;
};

export type RetrievedChunk = RagChunk & {
  score: number;
};

const OLLAMA_URL = (
  process.env.OLLAMA_BASE_URL || "http://localhost:11434"
).replace(/\/+$/, "");

const EMBEDDING_MODEL =
  process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text:latest";

const EMBEDDING_TIMEOUT_MS = 90_000;
const MAX_CACHE_ENTRIES = 1000;
const EMBEDDING_BATCH_SIZE = 8;

const embeddingCache = new Map<string, number[]>();

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function getCacheKey(text: string): string {
  return `${EMBEDDING_MODEL}:${normalizeText(text)}`;
}

export function chunkText(
  source: string,
  text: string,
  chunkSize = 1000,
  overlap = 150
): RagChunk[] {
  const normalized = normalizeText(text);

  if (!normalized) return [];

  if (
    !Number.isInteger(chunkSize) ||
    !Number.isInteger(overlap) ||
    chunkSize <= 0 ||
    overlap < 0 ||
    overlap >= chunkSize
  ) {
    throw new Error("Invalid chunk size or overlap.");
  }

  const chunks: RagChunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const chunk = normalized.slice(start, end).trim();

    if (chunk) {
      chunks.push({
        id: `${source}-${chunkIndex}`,
        source,
        text: chunk,
        chunkIndex,
      });
    }

    if (end >= normalized.length) break;

    start = end - overlap;
    chunkIndex++;
  }

  return chunks;
}

function cacheEmbedding(key: string, vector: number[]): void {
  embeddingCache.delete(key);
  embeddingCache.set(key, vector);

  while (embeddingCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = embeddingCache.keys().next().value;

    if (oldestKey === undefined) break;

    embeddingCache.delete(oldestKey);
  }
}

function getCachedEmbedding(key: string): number[] | undefined {
  const cached = embeddingCache.get(key);

  if (!cached) return undefined;

  // Refresh insertion order for recently used embeddings.
  embeddingCache.delete(key);
  embeddingCache.set(key, cached);

  return cached;
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item: unknown) =>
        typeof item === "number" && Number.isFinite(item)
    )
  );
}

async function requestEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const response = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
    signal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");

    throw new Error(
      `Ollama embedding request failed (${response.status}): ${details.slice(0, 300)}`
    );
  }

  const data: unknown = await response.json();

  if (
    typeof data !== "object" ||
    data === null ||
    !("embeddings" in data) ||
    !Array.isArray(data.embeddings)
  ) {
    throw new Error("Ollama returned an invalid embeddings response.");
  }

  const embeddings = data.embeddings as unknown[];

  if (
    embeddings.length !== texts.length ||
    !embeddings.every(isNumberArray)
  ) {
    throw new Error(
      `Expected ${texts.length} embeddings but received ${embeddings.length}.`
    );
  }

  return embeddings as number[][];
}

async function createEmbeddings(
  inputTexts: string[]
): Promise<number[][]> {
  const texts = inputTexts.map(normalizeText);

  if (texts.some((text) => !text)) {
    throw new Error("Cannot create embeddings for empty text.");
  }

  const results = new Array<number[]>(texts.length);
  const missingByKey = new Map<
    string,
    { text: string; indexes: number[] }
  >();

  // Reuse cached vectors and group duplicate text.
  texts.forEach((text, index) => {
    const key = getCacheKey(text);
    const cached = getCachedEmbedding(key);

    if (cached) {
      results[index] = cached;
      return;
    }

    const existing = missingByKey.get(key);

    if (existing) {
      existing.indexes.push(index);
    } else {
      missingByKey.set(key, {
        text,
        indexes: [index],
      });
    }
  });

  const missing = Array.from(missingByKey.entries());

  // Send several texts in one Ollama request instead of one
  // HTTP request per chunk.
  for (
    let start = 0;
    start < missing.length;
    start += EMBEDDING_BATCH_SIZE
  ) {
    const batch = missing.slice(
      start,
      start + EMBEDDING_BATCH_SIZE
    );

    const vectors = await requestEmbeddings(
      batch.map(([, entry]) => entry.text)
    );

    batch.forEach(([key, entry], batchIndex) => {
      const vector = vectors[batchIndex];

      cacheEmbedding(key, vector);

      for (const originalIndex of entry.indexes) {
        results[originalIndex] = vector;
      }
    });
  }

  return results;
}

export async function createEmbedding(
  text: string
): Promise<number[]> {
  const vectors = await createEmbeddings([text]);
  return vectors[0];
}

export function cosineSimilarity(
  vectorA: number[],
  vectorB: number[]
): number {
  if (
    vectorA.length === 0 ||
    vectorA.length !== vectorB.length
  ) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return (
    dotProduct /
    (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
  );
}

export async function retrieveRelevantChunks(
  question: string,
  chunks: RagChunk[],
  topK = 5
): Promise<RetrievedChunk[]> {
  const normalizedQuestion = normalizeText(question);

  if (
    !normalizedQuestion ||
    chunks.length === 0 ||
    !Number.isFinite(topK) ||
    topK <= 0
  ) {
    return [];
  }

  // Embed the query and source chunks using the same model.
  const queryEmbedding = await createEmbedding(normalizedQuestion);

  const chunkEmbeddings = await createEmbeddings(
    chunks.map((chunk) => chunk.text)
  );

  const results: RetrievedChunk[] = chunks.map(
    (chunk, index) => ({
      ...chunk,
      score: cosineSimilarity(
        queryEmbedding,
        chunkEmbeddings[index]
      ),
    })
  );

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(Math.floor(topK), results.length));
}
