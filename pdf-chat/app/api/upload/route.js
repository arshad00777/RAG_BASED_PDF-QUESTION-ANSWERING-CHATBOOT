import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { chunkText } from "@/lib/chunk";
import { embedMany } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel request body limit is ~4.5 MB
const MAX_CHUNKS = 400;

export async function POST(req) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set on the server." }, { status: 500 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "PDF is larger than 4 MB. Try a smaller file." }, { status: 413 });
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buffer);
    const { text: pages, totalPages } = await extractText(pdf, { mergePages: false });

    let chunks = [];
    pages.forEach((pageText, i) => {
      for (const piece of chunkText(pageText)) chunks.push({ page: i + 1, text: piece });
    });

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No readable text found. This may be a scanned PDF (images only)." },
        { status: 422 }
      );
    }
    if (chunks.length > MAX_CHUNKS) chunks = chunks.slice(0, MAX_CHUNKS);

    const embeddings = await embedMany(chunks.map((c) => c.text));
    const withVectors = chunks.map((c, i) => ({ ...c, embedding: embeddings[i] }));

    return NextResponse.json({ name: file.name, totalPages, chunks: withVectors });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not process this PDF. " + (err.message || "") }, { status: 500 });
  }
}
