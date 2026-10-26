
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".txt",
  ".md",
  ".markdown",
] as const;

type ExtractedPage = {
  page: number;
  text: string;
};

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function POST(request: Request) {
  let loadingTask: ReturnType<typeof getDocument> | undefined;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Please select a file to upload." },
        { status: 400 }
      );
    }

    const extension = getExtension(file.name);

    if (
      !ALLOWED_EXTENSIONS.includes(
        extension as (typeof ALLOWED_EXTENSIONS)[number]
      )
    ) {
      return NextResponse.json(
        {
          error: "Supported formats: PDF, TXT, MD and Markdown.",
        },
        { status: 415 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "The selected file is empty." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Files must be 10 MB or smaller." },
        { status: 413 }
      );
    }

    const buffer = await file.arrayBuffer();
    let pages: ExtractedPage[] = [];

    if (extension === ".pdf") {
      loadingTask = getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
      });

      const pdfDocument = await loadingTask.promise;

      for (
        let pageNumber = 1;
        pageNumber <= pdfDocument.numPages;
        pageNumber++
      ) {
        const page = await pdfDocument.getPage(pageNumber);
        const content = await page.getTextContent();

        const text = content.items
          .map((item) => {
            if ("str" in item && typeof item.str === "string") {
              return item.str;
            }

            return "";
          })
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        pages.push({
          page: pageNumber,
          text,
        });
      }
    } else {
      const text = new TextDecoder("utf-8", {
        fatal: true,
      })
        .decode(buffer)
        .replace(/^\uFEFF/, "")
        .trim();

      pages = [
        {
          page: 1,
          text,
        },
      ];
    }

    const extractedText = pages
      .map((page) => page.text)
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (!extractedText) {
      return NextResponse.json(
        {
          error:
            extension === ".pdf"
              ? "No selectable text was found. This PDF may be scanned and require OCR."
              : "No readable text was found in this file.",
        },
        { status: 422 }
      );
    }

    const wordCount = extractedText
      .split(/\s+/)
      .filter(Boolean).length;

    return NextResponse.json({
      success: true,
      document: {
        id: randomUUID(),
        name: file.name,
        size: file.size,
        type: extension.slice(1),
        status: "completed",
        uploadedAt: new Date().toISOString(),
        pageCount: pages.length,
        extractedText,
        pages,
        wordCount,
      },
    });
  } catch (error) {
    console.error(
      "[materials/upload] Processing failed:",
      error
    );

    const message = getErrorMessage(error);

    const isTextEncodingError =
      error instanceof TypeError &&
      /encoded data|encoding|decoder|encoded string/i.test(message);

    return NextResponse.json(
      {
        error: isTextEncodingError
          ? "This text file is not valid UTF-8. Save it as UTF-8 and try again."
          : "File processing failed. Check the server terminal for details.",
        ...(process.env.NODE_ENV === "development"
          ? { details: message }
          : {}),
      },
      { status: 500 }
    );
  } finally {
    if (loadingTask) {
      try {
        await loadingTask.destroy();
      } catch (cleanupError) {
        console.error(
          "[materials/upload] PDF cleanup failed:",
          cleanupError
        );
      }
    }
  }
}
