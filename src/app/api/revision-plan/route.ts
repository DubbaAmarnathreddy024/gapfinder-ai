
import { NextResponse } from "next/server";

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

const ACTIVITY_TYPES: RevisionTask["activityType"][] = [
  "Learn",
  "Practice",
  "Review",
  "Test",
];

const PRIORITIES: RevisionTask["priority"][] = [
  "High",
  "Medium",
  "Low",
];

function getPriority(accuracy: number): RevisionTask["priority"] {
  if (accuracy < 50) return "High";
  if (accuracy < 80) return "Medium";
  return "Low";
}

function sortTopics(topics: TopicPerformance[]): TopicPerformance[] {
  return [...topics].sort(
    (a, b) => a.accuracy - b.accuracy || a.topic.localeCompare(b.topic)
  );
}

function fallbackPlan(topics: TopicPerformance[]): RevisionPlan {
  const sortedTopics = sortTopics(topics);

  const tasks: RevisionTask[] = sortedTopics.slice(0, 8).flatMap((topic) => {
    const priority = getPriority(topic.accuracy);
    const topicId = encodeURIComponent(topic.topic);

    const tasksForTopic: RevisionTask[] = [
      {
        id: `learn-${topicId}`,
        topic: topic.topic,
        title:
          topic.accuracy < 50
            ? `Relearn ${topic.topic}`
            : `Review ${topic.topic}`,
        description:
          topic.accuracy < 50
            ? "Review your study material, definitions, core principles, and worked examples. Write a short summary of the key ideas."
            : topic.accuracy < 80
              ? "Review the concepts behind missed questions and practise explaining them in your own words."
              : "Briefly review the main concepts and important details to maintain your understanding.",
        durationMinutes: topic.accuracy < 50 ? 25 : 15,
        priority,
        activityType: topic.accuracy < 50 ? "Learn" : "Review",
      },
      {
        id: `practice-${topicId}`,
        topic: topic.topic,
        title: `Practise ${topic.topic}`,
        description:
          "Answer 5–10 relevant questions from your study material. Check each answer and record concepts that need more review.",
        durationMinutes: 15,
        priority,
        activityType: "Practice",
      },
    ];

    // Strong topics need only a shorter maintenance review.
    if (topic.accuracy >= 80) {
      return [
        {
          ...tasksForTopic[0],
          id: `review-${topicId}`,
          title: `Maintain progress in ${topic.topic}`,
          description:
            "Review your key notes briefly and answer a few questions to check that you still remember the concepts.",
          durationMinutes: 10,
          activityType: "Review",
        },
      ];
    }

    return tasksForTopic;
  });

  const dailyGoalMinutes = Math.min(
    90,
    Math.max(
      30,
      tasks.slice(0, 3).reduce((sum, task) => sum + task.durationMinutes, 0)
    )
  );

  return {
    title: "Your Personalized Revision Plan",
    summary:
      "Start with your lowest-scoring topics. Review the fundamentals, practise relevant questions, and take another diagnostic quiz to measure improvement.",
    dailyGoalMinutes,
    tasks,
  };
}

function cleanPlan(
  value: unknown,
  topics: TopicPerformance[]
): RevisionPlan | null {
  if (!value || typeof value !== "object") return null;

  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.tasks)) return null;

  const topicByName = new Map(
    topics.map((topic) => [topic.topic, topic])
  );

  const tasks: RevisionTask[] = data.tasks
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object" && !Array.isArray(item)
    )
    .map((item, index) => {
      const topicName =
        typeof item.topic === "string" ? item.topic.trim() : "";

      // Never silently assign a task to an unrelated topic.
      if (!topicByName.has(topicName)) return null;

      const topic = topicByName.get(topicName)!;
      const title =
        typeof item.title === "string" ? item.title.trim() : "";
      const description =
        typeof item.description === "string"
          ? item.description.trim()
          : "";
      const minutes = Number(item.durationMinutes);

      const priority = PRIORITIES.includes(
        item.priority as RevisionTask["priority"]
      )
        ? (item.priority as RevisionTask["priority"])
        : getPriority(topic.accuracy);

      const activityType = ACTIVITY_TYPES.includes(
        item.activityType as RevisionTask["activityType"]
      )
        ? (item.activityType as RevisionTask["activityType"])
        : "Review";

      if (!title || !description || !Number.isFinite(minutes)) {
        return null;
      }

      return {
        id: `ai-task-${encodeURIComponent(topicName)}-${index}`,
        topic: topicName,
        title: title.slice(0, 120),
        description: description.slice(0, 500),
        durationMinutes: Math.min(120, Math.max(5, Math.round(minutes))),
        // Enforce priority from actual quiz performance.
        priority: getPriority(topic.accuracy),
        activityType,
      };
    })
    .filter((task): task is RevisionTask => task !== null)
    .slice(0, 12);

  if (tasks.length === 0) return null;

  // Weakest topics and their tasks appear first.
  tasks.sort((a, b) => {
    const accuracyA = topicByName.get(a.topic)?.accuracy ?? 100;
    const accuracyB = topicByName.get(b.topic)?.accuracy ?? 100;

    return (
      accuracyA - accuracyB ||
      a.topic.localeCompare(b.topic) ||
      a.title.localeCompare(b.title)
    );
  });

  const goal = Number(data.dailyGoalMinutes);

  return {
    title:
      typeof data.title === "string" && data.title.trim()
        ? data.title.trim().slice(0, 120)
        : "Your Personalized Revision Plan",
    summary:
      typeof data.summary === "string" && data.summary.trim()
        ? data.summary.trim().slice(0, 500)
        : "Focus on your learning gaps and practise regularly.",
    dailyGoalMinutes: Number.isFinite(goal)
      ? Math.min(240, Math.max(15, Math.round(goal)))
      : 45,
    tasks,
  };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  try {
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "A valid request body is required." },
        { status: 400 }
      );
    }

    const rawTopics = (body as Record<string, unknown>).topics;

    if (!Array.isArray(rawTopics) || rawTopics.length === 0) {
      return NextResponse.json(
        {
          error:
            "No quiz topic results provided. Complete and submit a diagnostic quiz first.",
        },
        { status: 400 }
      );
    }

    const topics: TopicPerformance[] = rawTopics
      .filter(
        (item): item is Record<string, unknown> =>
          !!item &&
          typeof item === "object" &&
          !Array.isArray(item)
      )
      .map((item) => {
        const topic =
          typeof item.topic === "string"
            ? item.topic.trim().slice(0, 120)
            : "";

        const correct = Number(item.correct);
        const total = Number(item.total);

        return {
          topic,
          correct,
          total,
          accuracy:
            total > 0 && Number.isFinite(correct) && Number.isFinite(total)
              ? Math.round((correct / total) * 100)
              : 0,
        };
      })
      .filter(
        (item) =>
          item.topic.length > 0 &&
          Number.isInteger(item.correct) &&
          Number.isInteger(item.total) &&
          item.total > 0 &&
          item.total <= 10000 &&
          item.correct >= 0 &&
          item.correct <= item.total
      )
      .slice(0, 50);

    if (topics.length === 0) {
      return NextResponse.json(
        { error: "The submitted quiz topic results are invalid." },
        { status: 400 }
      );
    }

    // If duplicate topic names arrive, combine their quiz results.
    const combined = new Map<
      string,
      { correct: number; total: number }
    >();

    for (const topic of topics) {
      const current = combined.get(topic.topic) ?? {
        correct: 0,
        total: 0,
      };

      current.correct += topic.correct;
      current.total += topic.total;
      combined.set(topic.topic, current);
    }

    const normalizedTopics = sortTopics(
      Array.from(combined.entries()).map(([topic, result]) => ({
        topic,
        correct: result.correct,
        total: result.total,
        accuracy: Math.round((result.correct / result.total) * 100),
      }))
    );

    const fallback = fallbackPlan(normalizedTopics);
    const ollamaUrl = (
      process.env.OLLAMA_BASE_URL || "http://localhost:11434"
    ).replace(/\/+$/, "");
    const model = process.env.OLLAMA_MODEL || "llama3.2:3b";

    const prompt = `
You are a supportive, practical study coach.

Create a personalized revision plan using ONLY these quiz results:
${JSON.stringify(normalizedTopics)}

Requirements:
- Prioritize topics below 50% accuracy first.
- Next prioritize topics from 50% to 79% accuracy.
- Topics at 80% or above need maintenance rather than intensive relearning.
- Use only exact topic names from the supplied JSON.
- Give specific learning, practice, review, or testing actions.
- Do not invent student mistakes or claim facts not supported by the results.
- Create between 1 and 8 useful tasks.
- Use realistic durations in minutes.
- Return ONLY valid JSON, without Markdown fences.

Use this structure:
{
  "title": "Your Personalized Revision Plan",
  "summary": "A short, encouraging summary based on the results",
  "dailyGoalMinutes": 45,
  "tasks": [
    {
      "topic": "Exact topic name from results",
      "title": "Short task title",
      "description": "Specific action the student should perform",
      "durationMinutes": 20,
      "priority": "High",
      "activityType": "Learn"
    }
  ]
}

Allowed priority values: High, Medium, Low.
Allowed activityType values: Learn, Practice, Review, Test.
`;

    try {
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(90000),
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          format: "json",
          options: { temperature: 0.2 },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned HTTP ${response.status}`);
      }

      const result: unknown = await response.json();

      if (
        !result ||
        typeof result !== "object" ||
        typeof (result as Record<string, unknown>).response !== "string"
      ) {
        throw new Error("Ollama returned an invalid response.");
      }

      const responseText = (result as Record<string, unknown>).response as string;
      const generated: unknown = JSON.parse(responseText);
      const plan = cleanPlan(generated, normalizedTopics);

      if (plan) {
        return NextResponse.json({
          plan,
          source: "ollama",
          model,
        });
      }

      throw new Error("Ollama did not produce any valid revision tasks.");
    } catch (error) {
      console.error(
        "Ollama revision plan generation failed; using fallback plan:",
        error instanceof Error ? error.message : error
      );
    }

    return NextResponse.json({
      plan: fallback,
      source: "fallback",
      model,
      message:
        "A score-based plan was created. Start Ollama to generate AI-personalized activities.",
    });
  } catch (error) {
    console.error("Revision plan API error:", error);

    return NextResponse.json(
      { error: "Unable to create the revision plan." },
      { status: 500 }
    );
  }
}
