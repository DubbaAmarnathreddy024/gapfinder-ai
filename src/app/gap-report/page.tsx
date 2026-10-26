
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileText,
  RefreshCw,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";

const HISTORY_KEY = "gapfinder-quiz-history-v1";

type TopicResult = {
  topic: string;
  correct: number;
  total: number;
  accuracy?: number;
  status?: string;
};

type QuizAttempt = {
  id: string;
  date: string;
  sourceName: string;
  score: number;
  totalQuestions: number;
  topicBreakdown: TopicResult[];
};

type AnalyzedTopic = {
  topic: string;
  correct: number;
  total: number;
  accuracy: number;
  status: "Weak" | "Medium" | "Strong";
  reason: string;
};

function getStatus(accuracy: number): AnalyzedTopic["status"] {
  if (accuracy < 50) return "Weak";
  if (accuracy < 80) return "Medium";
  return "Strong";
}

function getRecommendations(topic: AnalyzedTopic) {
  if (topic.accuracy < 50) {
    return {
      priority: "High",
      title: `Relearn ${topic.topic}`,
      description:
        "Review your study notes, understand the core concepts, and take another quiz on this topic.",
      duration: "20–30 min",
    };
  }

  if (topic.accuracy < 80) {
    return {
      priority: "Medium",
      title: `Practice ${topic.topic}`,
      description:
        "Revise the concepts you missed and solve more practice questions to improve accuracy.",
      duration: "15–20 min",
    };
  }

  return {
    priority: "Low",
    title: `Maintain ${topic.topic}`,
    description:
      "You are performing well. Use a short review or practice quiz to retain your understanding.",
    duration: "5–10 min",
  };
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Weak: "bg-rose-50 text-rose-700 ring-rose-200",
    Medium: "bg-amber-50 text-amber-700 ring-amber-200",
    Strong: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
        styles[status] ?? "bg-slate-100 text-slate-600 ring-slate-200"
      }`}
    >
      {status}
    </span>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{title}</p>
        <span className={`rounded-xl p-2.5 ${color}`}>
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </article>
  );
}

export default function GapReportPage() {
  const [history, setHistory] = useState<QuizAttempt[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState("all");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function loadHistory() {
      try {
        const raw = localStorage.getItem(HISTORY_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];

        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (item): item is QuizAttempt =>
              item !== null &&
              typeof item === "object" &&
              typeof item.id === "string" &&
              typeof item.score === "number" &&
              typeof item.totalQuestions === "number" &&
              Array.isArray(item.topicBreakdown)
          );

          setHistory(valid);
        } else {
          setHistory([]);
        }
      } catch (error) {
        console.error("Unable to load quiz history:", error);
        setHistory([]);
      }

      setLoaded(true);
    }

    loadHistory();

    // Refresh if a quiz is completed in another browser tab.
    window.addEventListener("storage", loadHistory);

    return () => window.removeEventListener("storage", loadHistory);
  }, []);

  const selectedAttempt = useMemo(
    () =>
      selectedAttemptId === "all"
        ? null
        : history.find((item) => item.id === selectedAttemptId) ?? null,
    [history, selectedAttemptId]
  );

  const analyzedTopics = useMemo<AnalyzedTopic[]>(() => {
    const attempts = selectedAttempt ? [selectedAttempt] : history;
    const totals = new Map<
      string,
      { correct: number; total: number }
    >();

    for (const attempt of attempts) {
      for (const result of attempt.topicBreakdown) {
        if (
          typeof result.topic !== "string" ||
          typeof result.correct !== "number" ||
          typeof result.total !== "number" ||
          result.total <= 0
        ) {
          continue;
        }

        const existing = totals.get(result.topic) ?? {
          correct: 0,
          total: 0,
        };

        existing.correct += Math.max(
          0,
          Math.min(result.correct, result.total)
        );
        existing.total += result.total;
        totals.set(result.topic, existing);
      }
    }

    return Array.from(totals.entries())
      .map(([topic, result]) => {
        const accuracy =
          result.total > 0
            ? Math.round((result.correct / result.total) * 100)
            : 0;

        const status = getStatus(accuracy);
        const incorrect = Math.max(0, result.total - result.correct);

        const reason =
          status === "Weak"
            ? `You answered ${incorrect} of ${result.total} questions incorrectly (${accuracy}% accuracy). Focus on reviewing the fundamentals of this topic.`
            : status === "Medium"
              ? `You answered ${result.correct} of ${result.total} questions correctly (${accuracy}% accuracy). Review missed concepts to improve consistency.`
              : `You answered ${result.correct} of ${result.total} questions correctly (${accuracy}% accuracy). Continue practicing periodically to maintain your understanding.`;

        return {
          topic,
          correct: result.correct,
          total: result.total,
          accuracy,
          status,
          reason,
        };
      })
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [history, selectedAttempt]);

  const stats = useMemo(() => {
    const attempts = selectedAttempt ? [selectedAttempt] : history;

    const totalQuestions = attempts.reduce(
      (sum, attempt) => sum + Math.max(0, attempt.totalQuestions),
      0
    );

    const totalCorrect = attempts.reduce(
      (sum, attempt) => sum + Math.max(0, attempt.score),
      0
    );

    const accuracy =
      totalQuestions > 0
        ? Math.round((totalCorrect / totalQuestions) * 100)
        : 0;

    return {
      attempts: attempts.length,
      totalQuestions,
      accuracy,
      weak: analyzedTopics.filter((topic) => topic.status === "Weak").length,
      medium: analyzedTopics.filter((topic) => topic.status === "Medium").length,
      strong: analyzedTopics.filter((topic) => topic.status === "Strong").length,
    };
  }, [history, selectedAttempt, analyzedTopics]);

  const recommendations = analyzedTopics
    .filter((topic) => topic.status !== "Strong")
    .slice(0, 4)
    .map((topic) => ({
      ...topic,
      ...getRecommendations(topic),
    }));

  if (!loaded) {
    return (
      <main className="gf-page flex min-h-screen items-center justify-center bg-[#f7f8fc]">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-slate-600 shadow-sm">
          <RefreshCw size={19} className="animate-spin text-violet-600" />
          Analyzing your quiz history...
        </div>
      </main>
    );
  }

  return (
    <main className="gf-page min-h-screen bg-[#f7f8fc] text-slate-900">
      {/* Header */}
      <header className="gf-page-header border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Back to home"
              className="rounded-xl border border-slate-200 p-2.5 transition hover:bg-slate-50"
            >
              <ArrowLeft size={19} />
            </Link>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <Target size={23} />
            </div>

            <div>
              <h1 className="text-xl font-bold">AI Gap Report</h1>
              <p className="text-sm text-slate-500">
                Understand what to improve next
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="attempt-filter" className="sr-only">
              Filter quiz attempts
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <Clock3 size={17} className="text-slate-500" />
              <select
                id="attempt-filter"
                value={selectedAttemptId}
                onChange={(event) => setSelectedAttemptId(event.target.value)}
                className="max-w-52 bg-transparent text-sm outline-none"
              >
                <option value="all">All quiz attempts</option>
                {history.map((attempt) => (
                  <option key={attempt.id} value={attempt.id}>
                    {attempt.sourceName || "Study material"} —{" "}
                    {formatDate(attempt.date)}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} className="text-slate-400" />
            </div>

            <Link
              href="/quiz"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              <BookOpen size={17} />
              Take quiz
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 p-5 md:p-8">
        {/* Intro */}
        <section>
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-600">
            PERFORMANCE ANALYTICS
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            Your learning gaps, clearly explained.
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            This report analyzes your saved quiz results, ranks topics by
            accuracy, and recommends what to revise first.
          </p>
        </section>

        {history.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-violet-200 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <BrainCircuit size={32} />
            </div>
            <h3 className="mt-5 text-xl font-bold">
              Your first gap report starts with a quiz
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              There are no saved quiz attempts yet. Open your study materials,
              generate a quiz, and submit your answers. Your topic analysis
              will appear here automatically.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/materials"
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                <UploadIcon />
                Open materials
              </Link>
              <Link
                href="/quiz"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold transition hover:bg-slate-50"
              >
                Go to quiz <ArrowUpRight size={16} />
              </Link>
            </div>
          </section>
        ) : (
          <>
            {/* Metric cards */}
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Overall accuracy"
                value={`${stats.accuracy}%`}
                description="Correct answers across selected attempts"
                icon={TrendingUp}
                color="bg-violet-100 text-violet-700"
              />
              <MetricCard
                title="Quiz attempts"
                value={String(stats.attempts)}
                description={
                  selectedAttempt ? "Selected attempt" : "Saved quiz history"
                }
                icon={FileText}
                color="bg-blue-100 text-blue-700"
              />
              <MetricCard
                title="Weak topics"
                value={String(stats.weak)}
                description="Below 50% accuracy"
                icon={CircleAlert}
                color="bg-rose-100 text-rose-700"
              />
              <MetricCard
                title="Strong topics"
                value={String(stats.strong)}
                description="At least 80% accuracy"
                icon={Trophy}
                color="bg-emerald-100 text-emerald-700"
              />
            </section>

            {/* Overall status */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-bold">Performance overview</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Based on {stats.totalQuestions} recorded questions.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  {selectedAttempt
                    ? "Single attempt"
                    : "Combined quiz history"}
                </span>
              </div>

              <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    stats.accuracy < 50
                      ? "bg-rose-500"
                      : stats.accuracy < 80
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${stats.accuracy}%` }}
                />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-rose-50 p-3">
                  <p className="text-2xl font-bold text-rose-700">
                    {stats.weak}
                  </p>
                  <p className="mt-1 text-xs text-rose-700">Weak</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="text-2xl font-bold text-amber-700">
                    {stats.medium}
                  </p>
                  <p className="mt-1 text-xs text-amber-700">Medium</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-2xl font-bold text-emerald-700">
                    {stats.strong}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">Strong</p>
                </div>
              </div>
            </section>

            {/* Topic analysis */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">Topic-by-topic analysis</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Lowest accuracy appears first.
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {analyzedTopics.length} topics analyzed
                </span>
              </div>

              {analyzedTopics.length === 0 ? (
                <p className="mt-6 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                  This attempt has no usable topic-level results. Complete a
                  quiz with topic classifications to populate this section.
                </p>
              ) : (
                <div className="mt-6 space-y-5">
                  {analyzedTopics.map((topic) => (
                    <article
                      key={topic.topic}
                      className="rounded-xl border border-slate-100 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-semibold">{topic.topic}</h4>
                          <p className="mt-1 text-xs text-slate-500">
                            {topic.correct} correct out of {topic.total}{" "}
                            recorded answers
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold tabular-nums">
                            {topic.accuracy}%
                          </span>
                          <StatusBadge status={topic.status} />
                        </div>
                      </div>

                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all ${
                            topic.status === "Weak"
                              ? "bg-rose-500"
                              : topic.status === "Medium"
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                          }`}
                          style={{ width: `${topic.accuracy}%` }}
                        />
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {topic.reason}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* Revision recommendations */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <Target size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Recommended revision</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Suggested actions based on your recorded accuracy.
                  </p>
                </div>
              </div>

              {recommendations.length === 0 ? (
                <div className="mt-6 rounded-xl bg-emerald-50 p-5">
                  <div className="flex items-center gap-2 font-semibold text-emerald-800">
                    <CheckCircle2 size={19} />
                    All analyzed topics are strong!
                  </div>
                  <p className="mt-2 text-sm leading-6 text-emerald-700">
                    Keep practicing periodically and take another quiz to check
                    whether your performance stays consistent.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {recommendations.map((item, index) => (
                    <article
                      key={item.topic}
                      className="rounded-2xl border border-slate-200 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-sm font-bold text-violet-700">
                          {index + 1}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            item.priority === "High"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {item.priority} priority
                        </span>
                      </div>

                      <h4 className="mt-4 font-bold">{item.title}</h4>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {item.description}
                      </p>

                      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                        <Clock3 size={15} />
                        Suggested time: {item.duration}
                        <span className="ml-auto font-semibold">
                          {item.accuracy}% accuracy
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <Link
                href="/quiz"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                Practice with another quiz
                <ArrowUpRight size={17} />
              </Link>
            </section>

            {/* Quiz history */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
              <div className="flex items-center gap-3">
                <FileText size={21} className="text-violet-600" />
                <div>
                  <h3 className="text-lg font-bold">Saved quiz attempts</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Select any attempt from the dropdown above to inspect its
                    topic analysis.
                  </p>
                </div>
              </div>

              <div className="mt-5 divide-y divide-slate-100">
                {history.map((attempt) => {
                  const accuracy =
                    attempt.totalQuestions > 0
                      ? Math.round(
                          (attempt.score / attempt.totalQuestions) * 100
                        )
                      : 0;

                  return (
                    <div
                      key={attempt.id}
                      className="flex flex-wrap items-center justify-between gap-4 py-4"
                    >
                      <div>
                        <p className="font-semibold">
                          {attempt.sourceName || "Study material"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(attempt.date)} ·{" "}
                          {attempt.totalQuestions} questions
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold">{accuracy}%</p>
                          <p className="text-xs text-slate-500">Accuracy</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedAttemptId(attempt.id)
                          }
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold transition hover:bg-slate-50"
                        >
                          Analyze
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        <footer className="flex flex-col justify-between gap-2 border-t border-slate-200 py-5 text-xs text-slate-400 sm:flex-row">
          <span>© 2026 GapFinder AI</span>
          <span>Analyze. Revise. Improve.</span>
        </footer>
      </div>
    </main>
  );
}

function UploadIcon() {
  return <FileText size={17} />;
}
