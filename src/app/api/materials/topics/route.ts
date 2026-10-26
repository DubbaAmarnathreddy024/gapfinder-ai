
const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "llama3.2:3b";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = body.text;
    const sourceName = body.sourceName || "Uploaded material";

    if (typeof text !== "string" || !text.trim()) {
      return Response.json(
        { error: "Please provide extracted study material in the text field." },
        { status: 400 }
      );
    }

    // Keep requests manageable for the local model.
    const studyText = text.slice(0, 24000);

    const prompt = `
You are GapFinder AI, an educational assistant.

Extract the important topics and subtopics from the supplied study material.
Use ONLY the supplied material. Do not invent topics or facts.

Return valid JSON with exactly this structure:
{
  "sourceName": "name of the material",
  "topics": [
    {
      "name": "topic name",
      "summary": "short explanation supported by the material",
      "subtopics": ["subtopic 1", "subtopic 2"],
      "evidence": "short exact phrase or sentence from the material"
    }
  ]
}

Rules:
- Return JSON only, without Markdown fences.
- Include only topics supported by the text.
- Keep topic and subtopic names concise.
- Use an empty array if no subtopics are supported.
- Do not claim page numbers because page information is not supplied here.
- Do not add information from outside the material.

Material name: ${sourceName}

Study material:
${studyText}
`;

    const ollamaResponse = await fetch(OLLAMA_URL, {
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
      signal: AbortSignal.timeout(120000),
    });

    if (!ollamaResponse.ok) {
      const details = await ollamaResponse.text();

      return Response.json(
        {
          error: "Ollama could not generate topics.",
          details,
        },
        { status: 502 }
      );
    }

    const result = await ollamaResponse.json();
    let topicsData;

    try {
      topicsData = JSON.parse(result.response);
    } catch {
      return Response.json(
        { error: "The AI returned invalid JSON. Please try again." },
        { status: 502 }
      );
    }

    if (!Array.isArray(topicsData.topics)) {
      return Response.json(
        { error: "The AI response did not contain a topics array." },
        { status: 502 }
      );
    }

    return Response.json({
      success: true,
      model: MODEL,
      sourceName,
      truncated: text.length > studyText.length,
      ...topicsData,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";

    const isConnectionError =
      message.includes("fetch failed") ||
      message.includes("ECONNREFUSED");

    return Response.json(
      {
        error: isConnectionError
          ? "Cannot connect to Ollama. Make sure Ollama is running."
          : message.includes("timed out") || message.includes("Timeout")
            ? "Topic extraction timed out. Try a shorter piece of text."
            : "Topic extraction failed.",
        details: message,
      },
      { status: 500 }
    );
  }
}
