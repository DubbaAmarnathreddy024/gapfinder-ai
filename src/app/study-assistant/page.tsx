
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  BookOpen,
  FileText,
  LoaderCircle,
  MessageCircle,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";

const MATERIALS_KEY = "gapfinder-materials-v1";

type Material = {
  id?: string;
  name: string;
  text: string;
};

type Source = {
  id: number;
  name: string;
  excerpt: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  grounded?: boolean;
};

const SUGGESTIONS = [
  "Explain the main concepts in my notes",
  "Summarize the important points",
  "What topics should I prepare for an exam?",
];

function findText(value: unknown, depth = 0): string {
  if (depth > 4 || !value || typeof value !== "object") {
    return "";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => findText(item, depth + 1))
      .filter(Boolean)
      .join("\n\n");
  }

  const object = value as Record<string, unknown>;

  // Check likely extracted-text fields first.
  for (const key of [
    "extractedText",
    "extracted_text",
    "content",
    "text",
    "fullText",
    "full_text",
    "parsedText",
    "parsed_text",
  ]) {
    if (
      typeof object[key] === "string" &&
      object[key].trim().length > 0
    ) {
      return object[key] as string;
    }
  }

  return "";
}

function readMaterials(): Material[] {
  try {
    const raw = localStorage.getItem(MATERIALS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.materials)
        ? parsed.materials
        : Array.isArray(parsed?.files)
          ? parsed.files
          : [];

    return list
      .map((item: Record<string, unknown>, index: number) => {
        const text = findText(item);
        const name =
          (typeof item.name === "string" && item.name) ||
          (typeof item.fileName === "string" && item.fileName) ||
          (typeof item.filename === "string" && item.filename) ||
          `Study material ${index + 1}`;

        return {
          id: typeof item.id === "string" ? item.id : String(index),
          name,
          text,
        };
      })
      .filter((item: Material) => item.text.trim().length > 0)
      .slice(0, 30);
  } catch {
    return [];
  }
}

function formatAnswer(text: string) {
  // Lightweight formatting for model-generated Markdown.
  // Text remains React text content rather than injected HTML.
  return text.split("\n").map((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("### ")) {
      return (
        <h4 key={index} className="mt-4 font-bold">
          {trimmed.slice(4)}
        </h4>
      );
    }

    if (trimmed.startsWith("## ")) {
      return (
        <h3 key={index} className="mt-4 text-base font-bold">
          {trimmed.slice(3)}
        </h3>
      );
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      return (
        <div key={index} className="flex gap-2 pl-1">
          <span>•</span>
          <span>{trimmed.slice(2)}</span>
        </div>
      );
    }

    if (/^\d+\.\s/.test(trimmed)) {
      return (
        <div key={index} className="pl-1">
          {trimmed}
        </div>
      );
    }

    if (!trimmed) {
      return <div key={index} className="h-2" />;
    }

    return <p key={index}>{trimmed}</p>;
  });
}

export default function StudyAssistantPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [materialsLoaded, setMaterialsLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMaterials(readMaterials());
    setMaterialsLoaded(true);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function askQuestion(value?: string) {
    const prompt = (value ?? question).trim();

    if (!prompt || loading) return;

    if (materials.length === 0) {
      setError(
        "No extracted study text was found. Upload materials with extracted text first."
      );
      return;
    }

    setError("");
    setQuestion("");

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
    };

    setMessages((current) => [...current, userMessage]);
    setLoading(true);

    try {
      const response = await fetch("/api/study-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: prompt,
          materials: materials.map((material) => ({
            name: material.name,
            text: material.text,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to answer that question."
        );
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer,
        sources: Array.isArray(data.sources) ? data.sources : [],
        grounded: Boolean(data.grounded),
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askQuestion();
  }

  function refreshMaterials() {
    setMaterials(readMaterials());
    setError("");
  }

  return (
    <main className="min-h-screen bg-[#F7F8FC] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Back to home"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50"
            >
              <ArrowLeft size={19} />
            </Link>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <MessageCircle size={23} />
            </div>

            <div>
              <h1 className="font-bold sm:text-lg">
                Study Materials Assistant
              </h1>
              <p className="text-xs text-slate-500 sm:text-sm">
                Ask questions about your notes
              </p>
            </div>
          </div>

          <button
            onClick={refreshMaterials}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 sm:text-sm"
          >
            Refresh materials
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 font-bold">
              <BookOpen size={19} className="text-violet-600" />
              Your study library
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Answers are based on the extracted text available from your
              uploaded study materials.
            </p>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-violet-50 p-3">
              <span className="text-sm text-violet-900">
                Materials available
              </span>
              <span className="text-xl font-bold text-violet-700">
                {materials.length}
              </span>
            </div>

            {materials.length > 0 && (
              <div className="mt-4 space-y-2">
                {materials.slice(0, 5).map((material) => (
                  <div
                    key={material.id ?? material.name}
                    className="flex items-start gap-2 rounded-lg p-2 text-sm"
                  >
                    <FileText
                      size={16}
                      className="mt-0.5 shrink-0 text-slate-400"
                    />
                    <span className="break-words text-slate-600">
                      {material.name}
                    </span>
                  </div>
                ))}

                {materials.length > 5 && (
                  <p className="text-xs text-slate-500">
                    And {materials.length - 5} more materials
                  </p>
                )}
              </div>
            )}

            <Link
              href="/materials"
              className="mt-4 block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold hover:bg-slate-50"
            >
              Manage materials
            </Link>
          </section>

          <section className="rounded-2xl border border-violet-100 bg-violet-50/70 p-5">
            <div className="flex items-center gap-2 font-bold text-violet-900">
              <Sparkles size={18} />
              Try asking
            </div>

            <div className="mt-3 space-y-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  disabled={loading || materials.length === 0}
                  onClick={() => void askQuestion(suggestion)}
                  className="w-full rounded-xl border border-violet-100 bg-white px-3 py-3 text-left text-sm leading-5 text-slate-700 hover:border-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2 font-bold">
              <Bot size={20} className="text-violet-600" />
              GapFinder AI
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Answers use retrieved passages from your study materials.
            </p>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
            {messages.length === 0 && (
              <div className="flex min-h-[42vh] flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                  <Sparkles size={30} />
                </div>
                <h2 className="mt-5 text-xl font-bold">
                  What would you like to learn?
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Ask about a concept, request a summary, or get help
                  understanding a difficult passage in your notes.
                </p>

                {materialsLoaded && materials.length === 0 && (
                  <Link
                    href="/materials"
                    className="mt-5 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700"
                  >
                    Upload study materials
                  </Link>
                )}
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${
                  message.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    message.role === "user"
                      ? "bg-slate-100 text-slate-700"
                      : "bg-violet-100 text-violet-700"
                  }`}
                >
                  {message.role === "user" ? (
                    <UserRound size={18} />
                  ) : (
                    <Bot size={19} />
                  )}
                </div>

                <div
                  className={`min-w-0 max-w-[88%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-violet-600 text-white"
                      : "bg-slate-50 text-slate-800"
                  }`}
                >
                  <div className="space-y-1 text-sm leading-6">
                    {formatAnswer(message.content)}
                  </div>

                  {message.role === "assistant" &&
                    message.sources &&
                    message.sources.length > 0 && (
                      <div className="mt-4 border-t border-slate-200 pt-3">
                        <p className="mb-2 text-xs font-bold text-slate-600">
                          Retrieved sources
                        </p>

                        <div className="space-y-2">
                          {message.sources.map((source) => (
                            <details
                              key={`${source.id}-${source.name}`}
                              className="rounded-lg border border-slate-200 bg-white p-3"
                            >
                              <summary className="cursor-pointer text-xs font-semibold text-violet-700">
                                {source.id}. {source.name}
                              </summary>
                              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">
                                {source.excerpt}
                              </p>
                            </details>
                          ))}
                        </div>
                      </div>
                    )}

                  {message.role === "assistant" &&
                    message.grounded === false && (
                      <p className="mt-3 border-t border-slate-200 pt-2 text-xs text-amber-700">
                        No relevant source passage was found for this answer.
                      </p>
                    )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <Bot size={19} />
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3">
                  <LoaderCircle size={16} className="animate-spin" />
                  Reading your notes and preparing an answer...
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {error && (
            <div
              role="alert"
              className="mx-4 mb-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="border-t border-slate-100 bg-white p-4 sm:p-5"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    void askQuestion();
                  }
                }}
                rows={2}
                maxLength={2000}
                placeholder="Ask a question about your study materials..."
                aria-label="Ask a question"
                className="max-h-40 min-h-12 flex-1 resize-y bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-400"
              />

              <button
                type="submit"
                disabled={loading || !question.trim() || materials.length === 0}
                aria-label="Send question"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>

            <div className="mt-2 flex flex-wrap justify-between gap-2 px-1 text-xs text-slate-400">
              <span>Enter to send · Shift+Enter for a new line</span>
              <span>{question.length}/2000</span>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
