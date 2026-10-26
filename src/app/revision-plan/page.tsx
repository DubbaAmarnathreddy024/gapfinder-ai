
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  ListChecks,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Target,
  BookOpen,
  Trophy,
  AlertCircle,
} from "lucide-react";

const HISTORY_KEY = "gapfinder-quiz-history-v1";
const PROGRESS_KEY = "gapfinder-revision-progress-v1";

type TopicBreakdown = {
  topic: string;
  correct: number;
  total: number;
  accuracy?: number;
  status?: string;
};

type QuizAttempt = {
  id: string;
  date: string;
  sourceName?: string;
  score: number;
  totalQuestions: number;
  topicBreakdown: TopicBreakdown[];
};

type TopicPerformance = {
  topic: string;
  correct: number;
  total: number;
  accuracy: number;
};

type RevisionTask = {
  id: string;
  topic: string;
  title: string;
  description: string;
  durationMinutes: number;
  priority: "High" | "Medium" | "Low";
  activityType: "Learn" | "Practice" | "Review" | "Test";
};

type RevisionPlan = {
  title: string;
  summary: string;
  dailyGoalMinutes: number;
  tasks: RevisionTask[];
};

function readHistory(): QuizAttempt[] {
  try {
    const value = JSON.parse(
      localStorage.getItem(HISTORY_KEY) || "[]"
    );

    if (!Array.isArray(value)) return [];

    return value.filter(
      (item): item is QuizAttempt =>
        !!item &&
        typeof item.id === "string" &&
        Array.isArray(item.topicBreakdown)
    );
  } catch {
    return [];
  }
}

function makeTopicSummary(
  attempts: QuizAttempt[]
): TopicPerformance[] {
  const totals = new Map<
    string,
    { correct: number; total: number }
  >();

  for (const attempt of attempts) {
    for (const entry of attempt.topicBreakdown) {
      const topic = entry.topic?.trim();
      const correct = Number(entry.correct);
      const total = Number(entry.total);

      if (
        !topic ||
        !Number.isFinite(correct) ||
        !Number.isFinite(total) ||
        total <= 0 ||
        correct < 0 ||
        correct > total
      ) {
        continue;
      }

      const current = totals.get(topic) ?? {
        correct: 0,
        total: 0,
      };

      current.correct += correct;
      current.total += total;
      totals.set(topic, current);
    }
  }

  return Array.from(totals.entries())
    .map(([topic, result]) => ({
      topic,
      correct: result.correct,
      total: result.total,
      accuracy: Math.round(
        (result.correct / result.total) * 100
      ),
    }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

function statusFor(accuracy: number) {
  if (accuracy < 50) {
    return {
      label: "Needs attention",
      className: "bg-red-50 text-red-700 border-red-200",
    };
  }

  if (accuracy < 80) {
    return {
      label: "Developing",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }

  return {
    label: "On track",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
}

function priorityStyle(priority: string) {
  if (priority === "High") {
    return "bg-red-50 text-red-700";
  }

  if (priority === "Medium") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-emerald-50 text-emerald-700";
}

export default function RevisionPlanPage() {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [plan, setPlan] = useState<RevisionPlan | null>(null);
  const [source, setSource] = useState<"ollama" | "fallback" | null>(
    null
  );
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    setAttempts(readHistory());

    try {
      const saved = JSON.parse(
        localStorage.getItem(PROGRESS_KEY) || "[]"
      );
      if (Array.isArray(saved)) {
        setCompleted(
          saved.filter((item): item is string => typeof item === "string")
        );
      }
    } catch {
      setCompleted([]);
    }

    setHistoryLoaded(true);
  }, []);

  useEffect(() => {
    if (historyLoaded) {
      localStorage.setItem(
        PROGRESS_KEY,
        JSON.stringify(completed)
      );
    }
  }, [completed, historyLoaded]);

  const topicSummary = useMemo(
    () => makeTopicSummary(attempts),
    [attempts]
  );

  const loadHistory = useCallback(() => {
    setAttempts(readHistory());
    setNotice("");
    setError("");
    setPlan(null);
    setSource(null);
  }, []);

  async function generatePlan() {
    if (topicSummary.length === 0) {
      setError(
        "No topic results were found. Complete and submit a Diagnostic Quiz first."
      );
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/revision-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: topicSummary }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to generate your revision plan."
        );
      }

      setPlan(data.plan);
      setSource(data.source);
      setModel(data.model || "");

      if (data.source === "fallback") {
        setNotice(
          "Your score-based plan is ready. Start Ollama for AI-generated activities."
        );
      }
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

  function toggleTask(taskId: string) {
    setCompleted((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId]
    );
  }

  const completedCount =
    plan?.tasks.filter((task) => completed.includes(task.id)).length ?? 0;

  const totalMinutes =
    plan?.tasks.reduce(
      (sum, task) => sum + task.durationMinutes,
      0
    ) ?? 0;

  const progress =
    plan && plan.tasks.length > 0
      ? Math.round((completedCount / plan.tasks.length) * 100)
      : 0;

  return (
    <main className="gf-page min-h-screen bg-[#F7F8FC] text-slate-900">
      <header className="gf-page-header sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Back to home"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50"
            >
              <ArrowLeft size={19} />
            </Link>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <CalendarDays size={23} />
            </div>

            <div>
              <h1 className="text-lg font-bold sm:text-xl">
                Personalized Revision Plan
              </h1>
              <p className="text-sm text-slate-500">
                Your next steps to stronger learning
              </p>
            </div>
          </div>

          <button
            onClick={loadHistory}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            <span className="hidden sm:inline">Refresh results</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-8">
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-violet-700">
            Your learning journey
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Study smarter, not just longer.
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Turn your diagnostic quiz results into practical revision
            activities, with extra attention on the topics that need it most.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            icon={<Target size={20} />}
            label="Topics analysed"
            value={String(topicSummary.length)}
          />
          <Metric
            icon={<BookOpen size={20} />}
            label="Revision tasks"
            value={String(plan?.tasks.length ?? 0)}
          />
          <Metric
            icon={<Clock3 size={20} />}
            label="Planned study time"
            value={plan ? `${totalMinutes} min` : "—"}
          />
          <Metric
            icon={<Trophy size={20} />}
            label="Tasks completed"
            value={`${completedCount}/${plan?.tasks.length ?? 0}`}
          />
        </section>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {notice && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {notice}
          </div>
        )}

        {topicSummary.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-violet-200 bg-white px-6 py-14 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <BrainCircuit size={30} />
            </div>
            <h3 className="mt-5 text-xl font-bold">
              Your revision plan starts with a quiz
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              We need saved topic-wise quiz results before we can personalize
              your revision activities.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/quiz"
                className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Take diagnostic quiz
              </Link>
              <Link
                href="/materials"
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold hover:bg-slate-50"
              >
                Open materials
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-violet-100 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2 text-sm font-semibold text-violet-700">
                    <Sparkles size={17} />
                    Ready when you are
                  </div>
                  <h3 className="mt-2 text-xl font-bold">
                    Create your next study session
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {topicSummary.length} topics found across your saved
                    quiz attempts. We'll prioritize lower-scoring topics.
                  </p>
                </div>

                <button
                  onClick={generatePlan}
                  disabled={loading}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <LoaderCircle className="animate-spin" size={19} />
                  ) : (
                    <Sparkles size={19} />
                  )}
                  {loading ? "Building your plan..." : "Generate revision plan"}
                </button>
              </div>

              <div className="mt-7 border-t border-slate-100 pt-5">
                <h4 className="mb-3 text-sm font-bold">
                  Your topic performance
                </h4>

                <div className="space-y-4">
                  {topicSummary.slice(0, 6).map((topic) => {
                    const status = statusFor(topic.accuracy);

                    return (
                      <div key={topic.topic}>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            {topic.topic}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">
                              {topic.correct}/{topic.total}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-1 text-xs font-medium ${status.className}`}
                            >
                              {topic.accuracy}% · {status.label}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${
                              topic.accuracy < 50
                                ? "bg-red-500"
                                : topic.accuracy < 80
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                            }`}
                            style={{ width: `${topic.accuracy}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {topicSummary.length > 6 && (
                  <p className="mt-3 text-xs text-slate-500">
                    Showing the six lowest-performing topics first.
                  </p>
                )}
              </div>
            </section>

            {plan && (
              <>
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-violet-700">
                        <BrainCircuit size={18} />
                        {source === "ollama"
                          ? `AI-generated · ${model}`
                          : "Score-based plan"}
                      </div>
                      <h3 className="mt-2 text-2xl font-bold">
                        {plan.title}
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        {plan.summary}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-violet-50 px-4 py-3 sm:min-w-36">
                      <p className="text-xs font-medium text-violet-700">
                        Suggested daily goal
                      </p>
                      <p className="mt-1 text-2xl font-bold text-violet-900">
                        {plan.dailyGoalMinutes} min
                      </p>
                    </div>
                  </div>

                  <div className="mt-7">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold">Your progress</span>
                      <span className="text-slate-500">{progress}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-violet-600 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {completedCount} of {plan.tasks.length} tasks completed.
                      Progress is saved in this browser.
                    </p>
                  </div>
                </section>

                <section>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                      <ListChecks size={21} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">
                        Your revision tasks
                      </h3>
                      <p className="text-sm text-slate-500">
                        Complete each activity at your own pace.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {plan.tasks.map((task, index) => {
                      const isDone = completed.includes(task.id);

                      return (
                        <article
                          key={task.id}
                          className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
                            isDone
                              ? "border-emerald-200"
                              : "border-slate-200"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <button
                              onClick={() => toggleTask(task.id)}
                              aria-label={
                                isDone
                                  ? `Mark ${task.title} incomplete`
                                  : `Mark ${task.title} complete`
                              }
                              className="mt-1 shrink-0 text-violet-600"
                            >
                              {isDone ? (
                                <CheckCircle2 size={24} className="text-emerald-600" />
                              ) : (
                                <Circle size={24} />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-slate-400">
                                  TASK {String(index + 1).padStart(2, "0")}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-semibold ${priorityStyle(task.priority)}`}
                                >
                                  {task.priority} priority
                                </span>
                                <span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700">
                                  {task.activityType}
                                </span>
                              </div>

                              <h4
                                className={`mt-2 font-bold ${
                                  isDone
                                    ? "text-slate-400 line-through"
                                    : "text-slate-900"
                                }`}
                              >
                                {task.title}
                              </h4>
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                {task.description}
                              </p>

                              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                                <span className="flex items-center gap-1.5">
                                  <BookOpen size={14} />
                                  {task.topic}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Clock3 size={14} />
                                  {task.durationMinutes} minutes
                                </span>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      onClick={generatePlan}
                      disabled={loading}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                    >
                      <RefreshCw size={16} />
                      Regenerate plan
                    </button>
                    <Link
                      href="/quiz"
                      className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700"
                    >
                      Retake diagnostic quiz
                    </Link>
                  </div>
                </section>
              </>
            )}
          </>
        )}

        <footer className="flex flex-wrap justify-between gap-3 border-t border-slate-200 py-5 text-xs text-slate-500">
          <span>© 2026 GapFinder AI</span>
          <span>Learn. Revise. Improve.</span>
        </footer>
      </div>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
        {icon}
      </div>
      <p className="mt-4 text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
