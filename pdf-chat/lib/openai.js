import OpenAI from "openai";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const EMBED_MODEL = "text-embedding-3-small";
// 512 dims keeps the payload small enough for Vercel's 4.5 MB response limit.
export const EMBED_DIMS = 512;
export const CHAT_MODEL = "gpt-4o-mini";

export async function embedMany(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const res = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: batch,
      dimensions: EMBED_DIMS,
    });
    for (const d of res.data) {
      out.push(d.embedding.map((n) => Math.round(n * 1e5) / 1e5));
    }
  }
  return out;
}
