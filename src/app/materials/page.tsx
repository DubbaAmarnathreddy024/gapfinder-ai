
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";

import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  FileUp,
  LoaderCircle,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import Link from "next/link";

type Material = {
  id: string;
  name: string;
  size: number;
  type: string;
  status: string;
  uploadedAt: string;
  pageCount: number;
  extractedText: string;
  pages: { page: number; text: string }[];
  wordCount: number;
};

type Topic = {
  name: string;
  summary: string;
  subtopics: string[];
  evidence: string;
};

type TopicResult = {
  success: boolean;
  model: string;
  sourceName: string;
  topics: Topic[];
  truncated: boolean;
};

const STORAGE_KEY = "gapfinder-materials-v1";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", ".markdown"];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Material | null>(null);
  const [dragging, setDragging] = useState(false);

  const [generatingId, setGeneratingId] = useState<string | null>(
    null
  );

  const [topicMaps, setTopicMaps] = useState<
    Record<string, TopicResult>
  >({});

  const inputRef = useRef<HTMLInputElement>(null);
  const materialsRef = useRef<Material[]>([]);

  // Load previously uploaded materials from this browser.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved) as Material[];

        materialsRef.current = parsed;
        setMaterials(parsed);
      }
    } catch {
      setError("Could not load saved materials from this browser.");
    }
  }, []);

  // Save materials to local browser storage.
  const saveMaterials = useCallback((next: Material[]) => {
    materialsRef.current = next;
    setMaterials(next);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setError(
        "Browser storage is full. Remove some materials or use smaller files."
      );
    }
  }, []);

  // Upload and extract text from study documents.
  const uploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);

    if (!files.length || busy) return;

    setError("");
    setNotice("");

    for (const file of files) {
      const extension = file.name.includes(".")
        ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
        : "";

      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        setError(
          `${file.name}: only PDF, TXT, MD and Markdown are supported.`
        );
        continue;
      }

      if (file.size === 0 || file.size > MAX_FILE_SIZE) {
        setError(
          `${file.name}: choose a non-empty file no larger than 10 MB.`
        );
        continue;
      }

      setBusy(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/materials/upload", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || `Upload failed (${response.status}).`
          );
        }

        const document = result.document as Material;

        const next = [
          document,
          ...materialsRef.current.filter(
            (item) => item.id !== document.id
          ),
        ];

        saveMaterials(next);

        setNotice(`${file.name} uploaded and processed successfully.`);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred.";

        setError(`${file.name}: ${message}`);
      } finally {
        setBusy(false);
      }
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files) {
      void uploadFiles(event.target.files);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);

    void uploadFiles(event.dataTransfer.files);
  };

  // Generate topics using the local Ollama-powered API.
  const generateTopics = async (material: Material) => {
    if (generatingId || !material.extractedText.trim()) {
      if (!material.extractedText.trim()) {
        setError(
          "No extracted text is available for this document."
        );
      }

      return;
    }

    setGeneratingId(material.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/materials/topics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceName: material.name,
          text: material.extractedText,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Could not generate the topic map."
        );
      }

      if (!Array.isArray(result.topics)) {
        throw new Error(
          "The AI response did not contain a valid topics list."
        );
      }

      setTopicMaps((previous) => ({
        ...previous,
        [material.id]: result as TopicResult,
      }));

      setNotice(`Topic map generated for ${material.name}.`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during topic extraction.";

      setError(message);
    } finally {
      setGeneratingId(null);
    }
  };

  // Remove a document from the browser library.
  const removeMaterial = (id: string) => {
    const next = materialsRef.current.filter(
      (item) => item.id !== id
    );

    saveMaterials(next);

    if (selected?.id === id) {
      setSelected(null);
    }

    setTopicMaps((previous) => {
      const updated = { ...previous };
      delete updated[id];
      return updated;
    });

    setNotice("Material removed from this browser.");
    setError("");
  };

  const filtered = materials.filter((material) =>
    material.name.toLowerCase().includes(query.toLowerCase())
  );

  const totalWords = materials.reduce(
    (sum, material) => sum + material.wordCount,
    0
  );

  return (
    <main className="gf-page min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="gf-page-header border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-5">
          <Link
            href="/"
            aria-label="Back to dashboard"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <ArrowLeft size={21} />
          </Link>

          <div>
            <h1 className="text-xl font-bold">My Materials</h1>

            <p className="mt-1 text-sm text-slate-500">
              Upload your study materials to begin finding knowledge gaps.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-5 py-7">
        {/* Statistics */}
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Total documents"
            value={String(materials.length)}
            icon={<FileText className="text-violet-600" />}
          />

          <StatCard
            label="Extracted words"
            value={totalWords.toLocaleString()}
            icon={<CheckCircle2 className="text-violet-600" />}
          />

          <StatCard
            label="Processing"
            value={
              busy
                ? "Uploading..."
                : generatingId
                  ? "Analyzing..."
                  : "Idle"
            }
            icon={
              busy || generatingId ? (
                <LoaderCircle className="animate-spin text-violet-600" />
              ) : (
                <Clock3 className="text-violet-600" />
              )
            }
          />
        </section>

        {/* Upload section */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">Upload study materials</h2>

          <p className="mt-1 text-sm text-slate-500">
            Add syllabus documents, textbook chapters, notes, or past papers.
          </p>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`mt-5 flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-8 text-center transition ${
              dragging
                ? "border-violet-500 bg-violet-50"
                : "border-slate-300 bg-slate-50/70"
            }`}
          >
            <div className="mb-4 rounded-xl bg-violet-100 p-3 text-violet-700">
              <FileUp size={28} />
            </div>

            <p className="font-semibold">
              Drag and drop your study files here
            </p>

            <p className="mt-2 text-sm text-slate-500">
              PDF, TXT, or Markdown · Maximum 10 MB per file
            </p>

            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.txt,.md,.markdown"
              multiple
              hidden
              onChange={handleFileChange}
            />

            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <Upload size={17} />
              )}

              {busy ? "Processing..." : "Choose files"}
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start justify-between gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
            >
              <span>{error}</span>

              <button
                type="button"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="mt-4 flex items-start justify-between gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"
            >
              <span>{notice}</span>

              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="Dismiss message"
              >
                <X size={18} />
              </button>
            </div>
          )}
        </section>

        {/* Document library */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-semibold">Your document library</h2>

              <p className="mt-1 text-sm text-slate-500">
                {materials.length} processed{" "}
                {materials.length === 1 ? "document" : "documents"}
              </p>
            </div>

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <Search size={17} className="text-slate-400" />

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search materials"
                className="w-full bg-transparent text-sm outline-none sm:w-48"
              />
            </label>
          </div>

          {filtered.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <FileText size={30} className="text-slate-300" />

              <p className="mt-3 font-medium">
                {materials.length === 0
                  ? "No materials found"
                  : "No matching materials"}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {materials.length === 0
                  ? "Upload your first study document to get started."
                  : "Try a different search term."}
              </p>
            </div>
          ) : (
            <div className="mt-5 divide-y divide-slate-100">
              {filtered.map((material) => (
                <div
                  key={material.id}
                  className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                >
                  <button
                    type="button"
                    onClick={() => setSelected(material)}
                    className="flex min-w-0 items-start gap-3 text-left"
                  >
                    <div className="rounded-lg bg-violet-50 p-3 text-violet-600">
                      <FileText size={22} />
                    </div>

                    <div className="min-w-0">
                      <p className="break-all font-medium">
                        {material.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {formatSize(material.size)} ·{" "}
                        {material.wordCount} words ·{" "}
                        {material.pageCount}{" "}
                        {material.pageCount === 1 ? "page" : "pages"}
                      </p>
                    </div>
                  </button>

                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      disabled={generatingId !== null || busy}
                      onClick={() => void generateTopics(material)}
                      className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {generatingId === material.id ? (
                        <LoaderCircle
                          size={16}
                          className="animate-spin"
                        />
                      ) : (
                        <Sparkles size={16} />
                      )}

                      {generatingId === material.id
                        ? "Analyzing..."
                        : "Generate Topic Map"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelected(material)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      Preview
                    </button>

                    <button
                      type="button"
                      onClick={() => removeMaterial(material.id)}
                      aria-label={`Delete ${material.name}`}
                      className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* AI-generated topic maps */}
        {Object.entries(topicMaps).map(([materialId, result]) => {
          const material = materials.find(
            (item) => item.id === materialId
          );

          if (!material) return null;

          return (
            <section
              key={materialId}
              className="rounded-2xl border border-violet-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-violet-100 p-3 text-violet-700">
                  <Sparkles size={24} />
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold">AI Topic Map</h2>

                  <p className="mt-1 break-all text-sm text-slate-500">
                    Source: {material.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Generated using {result.model}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setTopicMaps((previous) => {
                      const next = { ...previous };
                      delete next[materialId];
                      return next;
                    })
                  }
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  aria-label={`Close topic map for ${material.name}`}
                >
                  <X size={18} />
                </button>
              </div>

              {result.truncated && (
                <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  Only the first portion of this document was analyzed.
                </p>
              )}

              <div className="mt-5 space-y-4">
                {result.topics.map((topic, index) => (
                  <article
                    key={`${topic.name}-${index}`}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-sm font-bold text-violet-700">
                        {index + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">
                          {topic.name}
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {topic.summary}
                        </p>
                      </div>
                    </div>

                    {topic.subtopics.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-slate-700">
                          Subtopics
                        </h4>

                        <ul className="mt-2 space-y-2">
                          {topic.subtopics.map(
                            (subtopic, subIndex) => (
                              <li
                                key={`${subtopic}-${subIndex}`}
                                className="flex items-start gap-2 text-sm text-slate-600"
                              >
                                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-violet-500" />
                                {subtopic}
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}

                    {topic.evidence && (
                      <div className="mt-4 rounded-lg bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Supporting evidence
                        </p>

                        <p className="mt-2 text-sm italic leading-6 text-slate-700">
                          &ldquo;{topic.evidence}&rdquo;
                        </p>
                      </div>
                    )}
                  </article>
                ))}

                {result.topics.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No topics were extracted from this material.
                  </p>
                )}
              </div>

              <p className="mt-4 text-xs text-slate-400">
                AI-generated results may be inaccurate. Verify topics
                against your original material. Supporting evidence
                has not yet been independently verified.
              </p>
            </section>
          );
        })}

        <p className="text-xs leading-5 text-slate-500">
          Demo storage: extracted text is stored in this browser only.
          Clearing browser data can remove it. This is not yet secure
          cloud storage.
        </p>
      </div>

      {/* Document preview dialog */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelected(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Preview ${selected.name}`}
            className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div className="min-w-0">
                <h2 className="break-all font-semibold">
                  {selected.name}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {selected.wordCount} words · {selected.pageCount} pages
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close preview"
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <pre className="overflow-auto whitespace-pre-wrap break-words p-5 text-sm leading-7 text-slate-700">
              {selected.extractedText}
            </pre>
          </section>
        </div>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-3 text-2xl font-bold">{value}</p>
      </div>

      {icon}
    </div>
  );
}
