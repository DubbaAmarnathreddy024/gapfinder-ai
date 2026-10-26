
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";

type Material = {
  id: string;
  name: string;
  extractedText: string;
  wordCount: number;
};

type Question = {
  topic: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  evidence: string;
};

type QuizResponse = {
  success: boolean;
  model: string;
  sourceName: string;
  questions: Question[];
  truncated: boolean;
};

const STORAGE_KEY = "gapfinder-materials-v1";

export default function QuizPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialId, setMaterialId] = useState("");
  const [questionCount, setQuestionCount] = useState("5");
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved) as Material[];
        setMaterials(parsed);

        if (parsed.length > 0) {
          setMaterialId(parsed[0].id);
        }
      }
    } catch {
      setError("Could not load your saved materials.");
    }
  }, []);

  const selectedMaterial = materials.find(
    (material) => material.id === materialId
  );

  const generateQuiz = async () => {
    if (!selectedMaterial) {
      setError("Please upload a study document first.");
      return;
    }

    if (!selectedMaterial.extractedText.trim()) {
      setError("This document does not contain extracted text.");
      return;
    }

    setLoading(true);
    setError("");
    setQuiz(null);
    setAnswers({});
    setCurrentQuestion(0);
    setSubmitted(false);

    try {
      const response = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceName: selectedMaterial.name,
          text: selectedMaterial.extractedText,
          questionCount: Number(questionCount),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to generate the quiz."
        );
      }

      if (
        !Array.isArray(result.questions) ||
        result.questions.length === 0
      ) {
        throw new Error(
          "No valid questions were generated. Try a longer document."
        );
      }

      setQuiz(result as QuizResponse);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (answer: string) => {
    if (submitted) return;

    setAnswers((previous) => ({
      ...previous,
      [currentQuestion]: answer,
    }));
  };

  const score = quiz
    ? quiz.questions.reduce(
        (total, question, index) =>
          total +
          (answers[index] === question.correctAnswer ? 1 : 0),
        0
      )
    : 0;

  const percentage =
    quiz && quiz.questions.length > 0
      ? Math.round((score / quiz.questions.length) * 100)
      : 0;

  const topicResults = quiz
    ? Object.values(
        quiz.questions.reduce<
          Record<
            string,
            { correct: number; total: number }
          >
        >((groups, question, index) => {
          const topic = question.topic || "General";

          if (!groups[topic]) {
            groups[topic] = { correct: 0, total: 0 };
          }

          groups[topic].total += 1;

          if (answers[index] === question.correctAnswer) {
            groups[topic].correct += 1;
          }

          return groups;
        }, {})
      )
    : [];

  const topicBreakdown = quiz
    ? Object.entries(
        quiz.questions.reduce<
          Record<
            string,
            { correct: number; total: number }
          >
        >((groups, question, index) => {
          const topic = question.topic || "General";

          if (!groups[topic]) {
            groups[topic] = { correct: 0, total: 0 };
          }

          groups[topic].total += 1;

          if (answers[index] === question.correctAnswer) {
            groups[topic].correct += 1;
          }

          return groups;
        }, {})
      ).map(([topic, result]) => {
        const percent = Math.round(
          (result.correct / result.total) * 100
        );

        return {
          topic,
          ...result,
          percent,
          level:
            percent < 50
              ? "Weak"
              : percent < 80
                ? "Medium"
                : "Strong",
        };
      })
    : [];

  const restartQuiz = () => {
    setQuiz(null);
    setAnswers({});
    setCurrentQuestion(0);
    setSubmitted(false);
    setError("");
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-5">
          <Link
            href="/"
            aria-label="Back to dashboard"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <ArrowLeft size={21} />
          </Link>

          <div>
            <h1 className="text-xl font-bold">
              Diagnostic Quiz
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Test your understanding and discover knowledge gaps.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-5 py-7">
        {!quiz && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-violet-100 p-3 text-violet-700">
                <Sparkles size={25} />
              </div>

              <div>
                <h2 className="text-lg font-bold">
                  Create your personalized quiz
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Choose your uploaded study material. Local AI
                  will generate multiple-choice questions from
                  its extracted text.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="material"
                  className="mb-2 block text-sm font-semibold"
                >
                  Study material
                </label>

                <select
                  id="material"
                  value={materialId}
                  onChange={(event) =>
                    setMaterialId(event.target.value)
                  }
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
                >
                  <option value="">
                    Select a document
                  </option>

                  {materials.map((material) => (
                    <option
                      key={material.id}
                      value={material.id}
                    >
                      {material.name} ({material.wordCount} words)
                    </option>
                  ))}
                </select>

                {materials.length === 0 && (
                  <p className="mt-2 text-sm text-amber-700">
                    No saved materials found. Upload a document
                    on the{" "}
                    <Link
                      href="/materials"
                      className="font-semibold underline"
                    >
                      My Materials
                    </Link>{" "}
                    page first.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="questionCount"
                  className="mb-2 block text-sm font-semibold"
                >
                  Number of questions
                </label>

                <select
                  id="questionCount"
                  value={questionCount}
                  onChange={(event) =>
                    setQuestionCount(event.target.value)
                  }
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500 sm:max-w-xs"
                >
                  <option value="3">3 questions</option>
                  <option value="5">5 questions</option>
                  <option value="8">8 questions</option>
                  <option value="10">10 questions</option>
                </select>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
                >
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={() => void generateQuiz()}
                disabled={loading || materials.length === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {loading ? (
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Sparkles size={18} />
                )}

                {loading
                  ? "Generating quiz..."
                  : "Generate Diagnostic Quiz"}
              </button>

              {loading && (
                <p className="text-sm text-slate-500">
                  Your local AI model is preparing questions.
                  This may take a little while.
                </p>
              )}
            </div>
          </section>
        )}

        {quiz && !submitted && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm text-slate-500">
                  Source: {quiz.sourceName}
                </p>

                <h2 className="mt-1 text-lg font-bold">
                  Question {currentQuestion + 1} of{" "}
                  {quiz.questions.length}
                </h2>
              </div>

              <span className="rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">
                {Object.keys(answers).length} answered
              </span>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-violet-600 transition-all"
                style={{
                  width: `${
                    ((currentQuestion + 1) /
                      quiz.questions.length) *
                    100
                  }%`,
                }}
              />
            </div>

            <div className="mt-6">
              <span className="inline-flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
                <BookOpen size={14} />
                {quiz.questions[currentQuestion].topic}
              </span>

              <h3 className="mt-4 text-lg font-semibold leading-8">
                {quiz.questions[currentQuestion].question}
              </h3>

              <div className="mt-5 space-y-3">
                {quiz.questions[currentQuestion].options.map(
                  (option) => {
                    const letter = option.charAt(0);
                    const selectedAnswer =
                      answers[currentQuestion] === letter;

                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => selectAnswer(letter)}
                        className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left text-sm transition ${
                          selectedAnswer
                            ? "border-violet-500 bg-violet-50 text-violet-900"
                            : "border-slate-200 hover:border-violet-300 hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                            selectedAnswer
                              ? "bg-violet-600 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {letter}
                        </span>

                        <span className="pt-1">
                          {option.slice(2).trim()}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div className="mt-7 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                disabled={currentQuestion === 0}
                onClick={() =>
                  setCurrentQuestion((previous) => previous - 1)
                }
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>

              {currentQuestion < quiz.questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setCurrentQuestion((previous) => previous + 1)
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  Next question
                  <ChevronRight size={17} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSubmitted(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 size={17} />
                  Submit quiz
                </button>
              )}
            </div>

            {currentQuestion === quiz.questions.length - 1 &&
              Object.keys(answers).length < quiz.questions.length && (
                <p className="mt-3 text-right text-xs text-amber-700">
                  You have unanswered questions. You can still submit.
                </p>
              )}
          </section>
        )}

        {quiz && submitted && (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col items-center text-center">
                <div className="rounded-2xl bg-violet-100 p-4 text-violet-700">
                  <Trophy size={32} />
                </div>

                <h2 className="mt-4 text-2xl font-bold">
                  Quiz completed!
                </h2>

                <p className="mt-2 text-slate-500">
                  Results for {quiz.sourceName}
                </p>

                <p className="mt-5 text-5xl font-bold text-violet-700">
                  {percentage}%
                </p>

                <p className="mt-2 font-semibold">
                  {score} out of {quiz.questions.length} correct
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  {percentage < 50
                    ? "Focus on revising the topics you missed."
                    : percentage < 80
                      ? "Good effort! Review the topics where you lost marks."
                      : "Great work! Keep practicing to retain your knowledge."}
                </p>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <ResultStat
                  label="Correct"
                  value={String(score)}
                  color="text-emerald-700"
                />

                <ResultStat
                  label="Incorrect"
                  value={String(
                    quiz.questions.length - score
                  )}
                  color="text-rose-700"
                />

                <ResultStat
                  label="Unanswered"
                  value={String(
                    quiz.questions.length -
                      Object.keys(answers).length
                  )}
                  color="text-slate-700"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold">
                Knowledge-gap analysis
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                These preliminary classifications are based on
                your answers to this quiz only.
              </p>

              <div className="mt-5 space-y-4">
                {topicBreakdown.map((item) => (
                  <div
                    key={item.topic}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">
                        {item.topic}
                      </h3>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          item.level === "Weak"
                            ? "bg-rose-50 text-rose-700"
                            : item.level === "Medium"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {item.level}
                      </span>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          item.level === "Weak"
                            ? "bg-rose-500"
                            : item.level === "Medium"
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                        }`}
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>

                    <p className="mt-2 text-sm text-slate-500">
                      {item.correct} of {item.total} correct ·{" "}
                      {item.percent}%
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold">
                Answer review
              </h2>

              <div className="mt-5 space-y-4">
                {quiz.questions.map((question, index) => {
                  const userAnswer = answers[index];
                  const isCorrect =
                    userAnswer === question.correctAnswer;

                  const correctOption =
                    question.options.find((option) =>
                      option.startsWith(
                        `${question.correctAnswer}.`
                      )
                    ) || question.correctAnswer;

                  return (
                    <article
                      key={`${question.topic}-${index}`}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-start gap-3">
                        {isCorrect ? (
                          <CheckCircle2
                            className="mt-1 shrink-0 text-emerald-600"
                            size={20}
                          />
                        ) : (
                          <XCircle
                            className="mt-1 shrink-0 text-rose-600"
                            size={20}
                          />
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-violet-700">
                            {question.topic}
                          </p>

                          <h3 className="mt-1 font-semibold leading-6">
                            {index + 1}. {question.question}
                          </h3>

                          <p className="mt-3 text-sm text-slate-600">
                            Your answer:{" "}
                            {userAnswer || "Not answered"}
                          </p>

                          <p className="mt-1 text-sm font-semibold text-emerald-700">
                            Correct answer: {correctOption}
                          </p>

                          <p className="mt-3 text-sm leading-6 text-slate-600">
                            {question.explanation}
                          </p>

                          {question.evidence && (
                            <blockquote className="mt-3 rounded-lg bg-slate-50 p-3 text-sm italic leading-6 text-slate-600">
                              Supporting text: &ldquo;
                              {question.evidence}
                              &rdquo;
                            </blockquote>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={restartQuiz}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50"
              >
                <RotateCcw size={17} />
                Generate another quiz
              </button>

              <Link
                href="/materials"
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700"
              >
                <BookOpen size={17} />
                My Materials
              </Link>
            </div>
          </>
        )}

        <p className="text-xs leading-5 text-slate-400">
          Questions and explanations are AI-generated. Check
          important answers against your original study material.
          Quiz results are currently held in page state and are
          not saved as permanent progress records.
        </p>
      </div>
    </main>
  );
}

function ResultStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 text-center">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>
        {value}
      </p>
    </div>
  );
}
