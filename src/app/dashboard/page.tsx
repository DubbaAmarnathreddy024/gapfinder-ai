
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  RefreshCw,
  Target,
  Trash2,
  Trophy,
} from "lucide-react";

const HISTORY_KEY = "gapfinder-quiz-history-v1";

type SavedTopic = {
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
  topicBreakdown: SavedTopic[];
};

type TopicSummary = {
  topic: string;
  correct: number;
  total: number;
  accuracy: number;
};

function readHistory(): QuizAttempt[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is QuizAttempt =>
        item !== null &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.date === "string" &&
        typeof item.score === "number" &&
        typeof item.totalQuestions === "number" &&
        Array.isArray(item.topicBreakdown)
    );
  } catch {
    return [];
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function accuracyOf(attempt: QuizAttempt) {
  return attempt.totalQuestions > 0
    ? Math.round((attempt.score / attempt.totalQuestions) * 100)
    : 0;
}

function StatCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Target;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <span className="rounded-xl bg-violet-50 p-2.5 text-violet-700">
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

export default function DashboardPage() {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [notice, setNotice] = useState("");

  const refreshHistory = useCallback(() => {
    setAttempts(readHistory());
    setLoaded(true);
  }, []);

  useEffect(() => {
    refreshHistory();

    function handleFocus() {
      refreshHistory();
    }

    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleFocus);
    };
  }, [refreshHistory]);

  const analytics = useMemo(() => {
    const totalQuestions = attempts.reduce(
      (sum, attempt) => sum + attempt.totalQuestions,
      0
    );

    const totalCorrect = attempts.reduce(
      (sum, attempt) => sum + attempt.score,
      0
    );

    const averageAccuracy = totalQuestions
      ? Math.round((totalCorrect / totalQuestions) * 100)
      : 0;

    const topicMap = new Map<
      string,
      { correct: number; total: number }
    >();

    for (const attempt of attempts) {
      for (const item of attempt.topicBreakdown ?? []) {
        const name = item.topic?.trim() || "General";
        const total = Number(item.total) || 0;
        const correct = Number(item.correct) || 0;

        if (!topicMap.has(name)) {
          topicMap.set(name, { correct: 0, total: 0 });
        }

        const existing = topicMap.get(name)!;
        existing.correct += correct;
        existing.total += total;
      }
    }

    const topics: TopicSummary[] = Array.from(topicMap.entries())
      .map(([topic, values]) => ({
        topic,
        ...values,
        accuracy: values.total
          ? Math.round((values.correct / values.total) * 100)
          : 0,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);

    const weakTopics = topics.filter((topic) => topic.accuracy < 50);
    const mediumTopics = topics.filter(
      (topic) => topic.accuracy >= 50 && topic.accuracy < 80
    );
    const strongTopics = topics.filter((topic) => topic.accuracy >= 80);

    const latestThree = attempts.slice(0, 3);
    const previousThree = attempts.slice(3, 6);

    const mean = (list: QuizAttempt[]) => {
      if (!list.length) return null;

      const questions = list.reduce(
        (sum, attempt) => sum + attempt.totalQuestions,
        0
      );
      const correct = list.reduce(
        (sum, attempt) => sum + attempt.score,
        0
      );

      return questions ? Math.round((correct / questions) * 100) : 0;
    };

    const recentAccuracy = mean(latestThree);
    const previousAccuracy = mean(previousThree);

    return {
      totalQuestions,
      totalCorrect,
      averageAccuracy,
      topics,
      weakTopics,
      mediumTopics,
      strongTopics,
      recentAccuracy,
      previousAccuracy,
      improvement:
        recentAccuracy !== null && previousAccuracy !== null
          ? recentAccuracy - previousAccuracy
          : null,
    };
  }, [attempts]);

  const filteredAttempts = useMemo(() => {
    if (selectedFilter === "all") return attempts;

    if (selectedFilter === "high") {
      return attempts.filter((attempt) => accuracyOf(attempt) >= 80);
    }

    if (selectedFilter === "low") {
      return attempts.filter((attempt) => accuracyOf(attempt) < 50);
    }

    return attempts;
  }, [attempts, selectedFilter]);

  function clearHistory() {
    const confirmed = window.confirm(
      "Delete all saved quiz history from this browser? This cannot be undone."
    );

    if (!confirmed) return;

    try {
      localStorage.removeItem(HISTORY_KEY);
      setAttempts([]);
      setNotice("Quiz history was cleared.");
    } catch {
      setNotice("Could not clear history. Check browser storage settings.");
    }
  }

  if (!loaded) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-slate-700">
        Loading your learning analytics...
      </main>
    );
  }

  const latestAttempt = attempts[0];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-600 p-3 text-white">
              <Brain size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">
                GapFinder AI
              </p>
              <h1 className="mt-1 text-xl font-bold">
                Knowledge Dashboard
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                refreshHistory();
                setNotice("Dashboard data refreshed.");
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <Link
              href="/quiz"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              <Target size={16} />
              Take a quiz
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-violet-700"
            >
              <ArrowLeft size={16} />
              Back to home
            </Link>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Your learning, at a glance.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Understand your performance, identify knowledge gaps, and
              choose what to revise next.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            <CalendarDays size={17} />
            {new Date().toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>

        {notice && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-800"
          >
            {notice}
            <button
              onClick={() => setNotice("")}
              className="font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {attempts.length === 0 ? (
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="grid items-center gap-8 p-7 sm:p-12 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
                  <SparklesIcon />
                  PERSONALIZED LEARNING
                </span>
                <h2 className="mt-5 text-3xl font-bold leading-tight">
                  Your next breakthrough starts with one quiz.
                </h2>
                <p className="mt-4 max-w-xl leading-7 text-slate-500">
                  Complete a diagnostic quiz based on your study notes.
                  GapFinder AI will track your results and highlight topics
                  that deserve more attention.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href="/quiz"
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700"
                  >
                    Start diagnostic quiz
                    <ArrowRight size={17} />
                  </Link>
                  <Link
                    href="/materials"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-semibold hover:bg-slate-50"
                  >
                    <BookOpen size={17} />
                    My materials
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950 p-6 text-white">
                <p className="text-sm text-slate-400">Your dashboard will track</p>
                <div className="mt-5 space-y-4">
                  {[
                    ["01", "Overall accuracy", "Measure progress across quizzes"],
                    ["02", "Knowledge gaps", "Find topics that need revision"],
                    ["03", "Learning progress", "Compare recent quiz attempts"],
                  ].map(([number, title, description]) => (
                    <div key={number} className="flex gap-4">
                      <span className="text-sm font-bold text-violet-300">
                        {number}
                      </span>
                      <div>
                        <p className="font-semibold">{title}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Quizzes completed"
                value={String(attempts.length)}
                detail="Saved attempts in this browser"
                icon={Trophy}
              />
              <StatCard
                title="Overall accuracy"
                value={`${analytics.averageAccuracy}%`}
                detail={`${analytics.totalCorrect} correct out of ${analytics.totalQuestions} questions`}
                icon={Target}
              />
              <StatCard
                title="Weak topics"
                value={String(analytics.weakTopics.length)}
                detail="Below 50% combined accuracy"
                icon={AlertTriangle}
              />
              <StatCard
                title="Strong topics"
                value={String(analytics.strongTopics.length)}
                detail="At least 80% combined accuracy"
                icon={CheckCircle2}
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">Topic mastery</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Combined performance across saved attempts.
                    </p>
                  </div>
                  <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                    {analytics.topics.length} topics
                  </span>
                </div>

                {analytics.topics.length === 0 ? (
                  <p className="mt-8 text-sm text-slate-500">
                    Topic-level results have not been saved for these attempts.
                    Complete another quiz to populate this section.
                  </p>
                ) : (
                  <div className="mt-6 space-y-5">
                    {analytics.topics.map((topic) => {
                      const level =
                        topic.accuracy < 50
                          ? "Weak"
                          : topic.accuracy < 80
                            ? "Developing"
                            : "Strong";

                      return (
                        <div key={topic.topic}>
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold">
                              {topic.topic}
                            </span>
                            <span className="text-xs text-slate-500">
                              {topic.correct}/{topic.total} correct ·{" "}
                              {topic.accuracy}%
                            </span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all ${
                                level === "Weak"
                                  ? "bg-rose-500"
                                  : level === "Developing"
                                    ? "bg-amber-400"
                                    : "bg-emerald-500"
                              }`}
                              style={{ width: `${topic.accuracy}%` }}
                            />
                          </div>
                          <p className="mt-1.5 text-xs text-slate-400">
                            {level}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
                    <Target size={22} />
                  </div>
                  <div>
                    <h2 className="font-bold">Revision priorities</h2>
                    <p className="text-sm text-slate-500">
                      Start with these topics
                    </p>
                  </div>
                </div>

                {analytics.weakTopics.length === 0 ? (
                  <div className="mt-6 rounded-xl bg-emerald-50 p-4">
                    <p className="font-semibold text-emerald-800">
                      No weak topics identified
                    </p>
                    <p className="mt-2 text-sm leading-6 text-emerald-700">
                      Keep practicing. Topics with fewer questions may need
                      more assessment before drawing conclusions.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {analytics.weakTopics.slice(0, 5).map((topic, index) => (
                      <div
                        key={topic.topic}
                        className="rounded-xl border border-rose-100 bg-rose-50/70 p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-rose-700">
                            Priority {index + 1}
                          </span>
                          <span className="text-sm font-bold text-rose-700">
                            {topic.accuracy}%
                          </span>
                        </div>
                        <h3 className="mt-2 font-semibold">{topic.topic}</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {topic.correct} of {topic.total} correct. Review your
                          notes, practice examples, and retest this topic.
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <Link
                  href="/materials"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900"
                >
                  Open study materials
                  <ArrowRight size={16} />
                </Link>
              </article>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-cyan-50 p-3 text-cyan-700">
                    <Activity size={22} />
                  </div>
                  <div>
                    <h2 className="font-bold">Recent performance</h2>
                    <p className="text-sm text-slate-500">
                      Accuracy across your most recent attempts
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Latest 3 quizzes</p>
                    <p className="mt-2 text-2xl font-bold">
                      {analytics.recentAccuracy === null
                        ? "—"
                        : `${analytics.recentAccuracy}%`}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Previous 3 quizzes</p>
                    <p className="mt-2 text-2xl font-bold">
                      {analytics.previousAccuracy === null
                        ? "—"
                        : `${analytics.previousAccuracy}%`}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                  {analytics.improvement === null ? (
                    <p className="text-sm leading-6 text-slate-500">
                      Complete at least four quizzes to compare the latest
                      three with the preceding three attempts.
                    </p>
                  ) : analytics.improvement > 0 ? (
                    <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <ArrowUpRight size={18} />
                      Accuracy improved by {analytics.improvement} percentage
                      points.
                    </p>
                  ) : analytics.improvement < 0 ? (
                    <p className="flex items-center gap-2 text-sm font-semibold text-rose-700">
                      <ArrowDownRight size={18} />
                      Accuracy changed by {analytics.improvement} percentage
                      points. Review recent mistakes.
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-slate-600">
                      Accuracy remained steady across the two periods.
                    </p>
                  )}
                </div>

                <div className="mt-6">
                  <p className="mb-3 text-sm font-semibold">Latest attempts</p>
                  <div className="space-y-3">
                    {attempts.slice(0, 5).map((attempt) => (
                      <div
                        key={attempt.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {attempt.sourceName || "Study Material"}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {formatDate(attempt.date)}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold">
                          {accuracyOf(attempt)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-amber-50 p-3 text-amber-700">
                    <Clock3 size={22} />
                  </div>
                  <div>
                    <h2 className="font-bold">Your learning plan</h2>
                    <p className="text-sm text-slate-500">
                      A simple next step based on your current results
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-700">
                      1
                    </span>
                    <div>
                      <h3 className="font-semibold">Review a weak topic</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {analytics.weakTopics[0]
                          ? `Begin with ${analytics.weakTopics[0].topic}, currently at ${analytics.weakTopics[0].accuracy}% accuracy.`
                          : "Complete more topic-based questions to find where you need support."}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                      2
                    </span>
                    <div>
                      <h3 className="font-semibold">Practice and retest</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        Take another quiz after reviewing the relevant material
                        to check your understanding.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                      3
                    </span>
                    <div>
                      <h3 className="font-semibold">Reinforce strong topics</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        Revisit strong topics periodically to help retain what
                        you have learned.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/materials"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                  >
                    <BookOpen size={16} />
                    Review notes
                  </Link>
                  <Link
                    href="/quiz"
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700"
                  >
                    Practice now
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </article>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">Quiz history</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Review the attempts saved in this browser.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label htmlFor="history-filter" className="sr-only">
                    Filter quiz history
                  </label>
                  <select
                    id="history-filter"
                    value={selectedFilter}
                    onChange={(event) => setSelectedFilter(event.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="all">All results</option>
                    <option value="high">80% and above</option>
                    <option value="low">Below 50%</option>
                  </select>

                  <button
                    onClick={clearHistory}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 size={16} />
                    Clear history
                  </button>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-3 pr-4 font-semibold">Study material</th>
                      <th className="py-3 pr-4 font-semibold">Score</th>
                      <th className="py-3 pr-4 font-semibold">Accuracy</th>
                      <th className="py-3 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttempts.map((attempt) => (
                      <tr key={attempt.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-4 pr-4 font-medium">
                          {attempt.sourceName || "Study Material"}
                        </td>
                        <td className="py-4 pr-4">
                          {attempt.score}/{attempt.totalQuestions}
                        </td>
                        <td className="py-4 pr-4">
                          <span
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                              accuracyOf(attempt) < 50
                                ? "bg-rose-50 text-rose-700"
                                : accuracyOf(attempt) < 80
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {accuracyOf(attempt)}%
                          </span>
                        </td>
                        <td className="py-4 text-slate-500">
                          {formatDate(attempt.date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredAttempts.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No attempts match this filter.
                  </p>
                )}
              </div>
            </section>
          </>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-400">
          <p>
            GapFinder AI · Local learning analytics
          </p>
          <p>
            Data is stored in this browser. Accuracy reflects saved quiz
            attempts and is not a formal assessment.
          </p>
        </footer>
      </div>
    </main>
  );
}

function SparklesIcon() {
  return <LayoutDashboard size={14} />;
}
