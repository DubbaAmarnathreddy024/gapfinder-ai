
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type MaterialPayload = {
  id?: string;
  name?: string;
  size?: number;
  type?: string;
  status?: string;
  uploadedAt?: string;
  pageCount?: number;
  extractedText?: string;
  pages?: { page: number; text: string }[];
  wordCount?: number;
};

type MaterialRow = {
  id: string;
  user_id?: string;
  name: string;
  file_type: string | null;
  file_size: number | null;
  extracted_text: string | null;
  word_count: number | null;
  page_count: number | null;
  created_at: string | null;
};

function toClientMaterial(row: MaterialRow) {
  const extractedText = row.extracted_text ?? "";

  return {
    id: row.id,
    name: row.name ?? "Untitled material",
    size: Number(row.file_size ?? 0),
    type: row.file_type ?? "",
    status: "processed",
    uploadedAt: row.created_at ?? new Date().toISOString(),
    pageCount: Number(row.page_count ?? 0),
    extractedText,
    // The current database stores extracted_text as one text block.
    pages: extractedText
      ? [{ page: 1, text: extractedText }]
      : [],
    wordCount: Number(
      row.word_count ??
        extractedText.split(/\s+/).filter(Boolean).length
    ),
  };
}

function errorResponse(
  message: string,
  status: number,
  details?: {
    code?: string;
    details?: string;
    hint?: string;
  }
) {
  return NextResponse.json(
    {
      error: message,
      ...(details?.code ? { code: details.code } : {}),
      ...(details?.details ? { details: details.details } : {}),
      ...(details?.hint ? { hint: details.hint } : {}),
    },
    { status }
  );
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

// GET: Load the signed-in user's materials.
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("GET materials authentication error:", userError);
      return errorResponse("Authentication failed.", 401);
    }

    if (!user) {
      return errorResponse("Authentication required. Please log in.", 401);
    }

    const { data, error } = await supabase
      .from("materials")
      .select(
        "id, name, file_type, file_size, extracted_text, word_count, page_count, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET materials Supabase error:", error);

      return errorResponse("Failed to load materials.", 500, {
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    }

    const materials = ((data ?? []) as MaterialRow[]).map(
      toClientMaterial
    );

    return NextResponse.json({ materials });
  } catch (error) {
    console.error("GET /api/materials exception:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Could not load materials.";

    return errorResponse(message, 500);
  }
}

// POST: Save an extracted document to Supabase.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("POST materials authentication error:", userError);
      return errorResponse("Authentication failed.", 401);
    }

    if (!user) {
      return errorResponse(
        "Authentication required. Please log in.",
        401
      );
    }

    let payload: MaterialPayload;

    try {
      payload = (await request.json()) as MaterialPayload;
    } catch {
      return errorResponse("Request body must be valid JSON.", 400);
    }

    if (
      typeof payload.name !== "string" ||
      !payload.name.trim() ||
      typeof payload.extractedText !== "string" ||
      !payload.extractedText.trim()
    ) {
      return errorResponse(
        "Material name and extracted text are required.",
        400
      );
    }

    const row: Record<string, unknown> = {
      user_id: user.id,
      name: payload.name.trim(),
      file_type:
        typeof payload.type === "string"
          ? payload.type
          : "text/plain",
      file_size: Number.isFinite(payload.size)
        ? payload.size
        : 0,
      extracted_text: payload.extractedText,
      word_count: Number.isFinite(payload.wordCount)
        ? payload.wordCount
        : payload.extractedText
            .trim()
            .split(/\s+/)
            .filter(Boolean).length,
      page_count: Number.isFinite(payload.pageCount)
        ? payload.pageCount
        : 1,
    };

    // Keep the incoming UUID only if it is valid.
    // A duplicate ID will be reported in the Supabase error response.
    if (payload.id && isValidUuid(payload.id)) {
      row.id = payload.id;
    }

    const { data, error } = await supabase
      .from("materials")
      .insert(row)
      .select(
        "id, name, file_type, file_size, extracted_text, word_count, page_count, created_at"
      )
      .single();

    if (error) {
      console.error("POST materials Supabase error:", error);

      return errorResponse("Failed to save material.", 500, {
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    }

    return NextResponse.json(
      {
        material: toClientMaterial(data as MaterialRow),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/materials exception:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Could not save material.";

    return errorResponse(message, 500);
  }
}

// DELETE: Delete only a material owned by the signed-in user.
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("DELETE materials authentication error:", userError);
      return errorResponse("Authentication failed.", 401);
    }

    if (!user) {
      return errorResponse(
        "Authentication required. Please log in.",
        401
      );
    }

    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return errorResponse("Material ID is required.", 400);
    }

    const { data, error } = await supabase
      .from("materials")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id");

    if (error) {
      console.error("DELETE materials Supabase error:", error);

      return errorResponse("Failed to delete material.", 500, {
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    }

    if (!data || data.length === 0) {
      return errorResponse(
        "Material not found or you do not have permission to delete it.",
        404
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/materials exception:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Could not delete material.";

    return errorResponse(message, 500);
  }
}
