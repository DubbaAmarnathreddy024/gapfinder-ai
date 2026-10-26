
import { NextResponse } from "next/server";
import {
  chunkText,
  retrieveRelevantChunks,
} from "@/lib/rag";

const OLLAMA_URL = (
  process.env.OLLAMA_BASE_URL || "http://localhost:11434"
).replace(/\/+$/, "");

const MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b";

type QuizQuestion = {
  topic: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  evidence: string;
  sourceName: string;
  sourceChunkId: string;
};

type RawQuizQuestion = {
  topic?: unknown;
  question?: unknown;
  options?: unknown;
  correctAnswer?: unknown;
  explanation?: unknown;
  evidence?: unknown;
  sourceChunkId?: unknown;
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function evidenceMatches(
  evidence: string,
  sourceText: string
): boolean {
  const normalizedEvidence = normalizeText(evidence);
  const normalizedSource = normalizeText(sourceText);

  return (
    normalizedEvidence.length >= 20 &&
    normalizedSource.includes(normalizedEvidence)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const text = body?.text;

    const sourceName =
      typeof body?.sourceName === "string"
        ? body.sourceName.trim().slice(0, 200) || "Study Material"
        : "Study Material";

    const requestedCount = Number(body?.questionCount ?? 5);

    if (typeof text !== "string" || text.trim().length < 100) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please provide study material containing at least 100 characters.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(requestedCount) ||
      requestedCount < 1 ||
      requestedCount > 10
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Question count must be between 1 and 10.",
        },
        { status: 400 }
      );
    }

    // Limit the input to keep local model processing manageable.
    const studyText = text.trim().slice(0, 18000);

    const chunks = chunkText(sourceName, studyText);

    if (chunks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No usable text chunks could be created.",
        },
        { status: 422 }
      );
    }

    // Retrieve the most relevant passages from the uploaded material.
    const retrieved = await retrieveRelevantChunks(
      "Important concepts, definitions, principles, applications, causes, effects, and relationships needed to assess understanding of this study material",
      chunks,
      Math.min(4, chunks.length)
    );

    if (retrieved.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No relevant passages were found. Please try different study material.",
        },
        { status: 422 }
      );
    }

    const passageContext = retrieved
      .map(
        (passage) =>
          `[PASSAGE_ID: ${passage.id}]\n` +
          `[SOURCE: ${passage.source}]\n` +
          passage.text
      )
      .join("\n\n---\n\n");

    // Index retrieved passages by ID so citations can be verified.
    const passagesById = new Map(
      retrieved.map((passage) => [passage.id, passage] as const)
    );

    const prompt = `
You are an educational diagnostic quiz generator.

Generate exactly ${requestedCount} distinct multiple-choice questions
using ONLY the study material passages provided below.

RULES:
1. Do not use outside knowledge.
2. Questions must test understanding, not just memorization.
3. Each question must have exactly four answer options.
4. Label the options A, B, C, and D.
5. correctAnswer must be exactly one letter: A, B, C, or D.
6. Provide a short explanation for the correct answer.
7. evidence must be an exact sentence or continuous excerpt copied from
   the passage that supports the question or answer.
8. evidence must contain at least 20 characters.
9. sourceChunkId must exactly match the PASSAGE_ID of the supporting passage.
10. topic must identify the concept being tested.
11. Do not repeat questions.
12. If the material does not support a question, do not invent one.

Return valid JSON only, in this format:
{
  "questions": [
    {
      "topic": "Topic name",
      "question": "Question text",
      "options": [
        "A. First option",
        "B. Second option",
        "C. Third option",
        "D. Fourth option"
      ],
      "correctAnswer": "A",
      "explanation": "Why this answer is correct",
      "evidence": "Exact text copied from the source passage.",
      "sourceChunkId": "EXACT_PASSAGE_ID"
    }
  ]
}

STUDY MATERIAL PASSAGES:
${passageContext}
`;

    const ollamaResponse = await fetch(
      `${OLLAMA_URL}/api/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          prompt,
          stream: false,
          format: "json",
          options: {
            temperature: 0.1,
          },
        }),
        signal: AbortSignal.timeout(180000),
      }
    );

    if (!ollamaResponse.ok) {
      const details = await ollamaResponse.text().catch(() => "");

      console.error(
        "Ollama quiz generation failed:",
        ollamaResponse.status,
        details
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "The local AI model could not generate the quiz. Check that Ollama is running and the model is available.",
        },
        { status: 502 }
      );
    }

    const ollamaData = await ollamaResponse.json();

    if (typeof ollamaData?.response !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "The AI model returned an invalid response.",
        },
        { status: 502 }
      );
    }

    let parsed: { questions?: unknown };

    try {
      parsed = JSON.parse(ollamaData.response);
    } catch {
      console.error(
        "Could not parse Ollama quiz JSON:",
        ollamaData.response
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "The AI returned invalid quiz JSON. Please try generating the quiz again.",
        },
        { status: 502 }
      );
    }

    if (!Array.isArray(parsed.questions)) {
      return NextResponse.json(
        {
          success: false,
          error: "The AI response did not contain a questions array.",
        },
        { status: 502 }
      );
    }

    const validQuestions: QuizQuestion[] = [];
    const seenQuestions = new Set<string>();

    for (const rawQuestion of parsed.questions) {
      const q = rawQuestion as RawQuizQuestion;

      // Validate the required fields before using string methods.
      if (
        !isNonEmptyString(q.topic) ||
        !isNonEmptyString(q.question) ||
        !isNonEmptyString(q.explanation) ||
        !isNonEmptyString(q.evidence) ||
        !isNonEmptyString(q.sourceChunkId) ||
        !Array.isArray(q.options) ||
        !isNonEmptyString(q.correctAnswer)
      ) {
        continue;
      }

      const topic = q.topic.trim();
      const question = q.question.trim();
      const explanation = q.explanation.trim();
      const evidence = q.evidence.trim();
      const correctAnswer = q.correctAnswer.trim().toUpperCase();

      const options: string[] = q.options.map((option: unknown) =>
        typeof option === "string" ? option.trim() : ""
      );

      if (
        options.length !== 4 ||
        options.some((option) => option.length === 0)
      ) {
        continue;
      }

      if (!["A", "B", "C", "D"].includes(correctAnswer)) {
        continue;
      }

      // Find the source passage associated with this citation.
      const passage = passagesById.get(q.sourceChunkId.trim());

      if (
        !passage ||
        !evidenceMatches(evidence, passage.text)
      ) {
        continue;
      }

      // Avoid duplicate questions.
      const questionKey = normalizeText(question).toLowerCase();

      if (seenQuestions.has(questionKey)) {
        continue;
      }

      seenQuestions.add(questionKey);

      validQuestions.push({
        topic,
        question,
        options,
        correctAnswer,
        explanation,
        evidence,
        sourceName: passage.source,
        sourceChunkId: passage.id,
      });

      if (validQuestions.length >= requestedCount) {
        break;
      }
    }

    if (validQuestions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The AI could not generate valid questions with verifiable citations from the uploaded material. Try different or more detailed material.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      model: MODEL,
      sourceName,
      questions: validQuestions,
      requestedCount,
      generatedCount: validQuestions.length,
      retrievedPassageCount: retrieved.length,
      truncated: text.trim().length > studyText.length,
    });
  } catch (error) {
    console.error("Quiz generation error:", error);

    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    const isConnectionError =
      error instanceof TypeError &&
      /fetch|network|connect/i.test(error.message);

    if (isTimeout) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Quiz generation timed out. Try shorter study material or fewer questions.",
        },
        { status: 504 }
      );
    }

    if (isConnectionError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot connect to Ollama. Start Ollama and verify that it is available at the configured URL.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "An unexpected error occurred while generating the quiz.",
      },
      { status: 500 }
    );
  }
}
