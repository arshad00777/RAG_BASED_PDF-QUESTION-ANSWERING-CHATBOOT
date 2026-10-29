import { NextResponse } from "next/server";
import { embedMany } from "@/lib/openai";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text." }, { status: 400 });
    }
    const [embedding] = await embedMany([text.slice(0, 2000)]);
    return NextResponse.json({ embedding });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Embedding failed." }, { status: 500 });
  }
}
