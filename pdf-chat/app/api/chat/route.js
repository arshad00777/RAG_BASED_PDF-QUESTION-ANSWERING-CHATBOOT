import { openai, CHAT_MODEL } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You answer questions about a PDF document using only the excerpts provided.
- Base every statement on the excerpts. Do not use outside knowledge.
- Cite the page for each claim like [p. 4].
- If the excerpts do not contain the answer, say: "I couldn't find that in the document." Then suggest what the person could ask instead.
- Be concise and clear. Use short lists only when they help.`;

export async function POST(req) {
  try {
    const { question, context = [], history = [] } = await req.json();
    if (!question) return new Response("Missing question.", { status: 400 });

    const excerpts = context
      .slice(0, 6)
      .map((c, i) => `Excerpt ${i + 1} (page ${c.page}):\n${c.text}`)
      .join("\n\n---\n\n");

    const messages = [
      { role: "system", content: SYSTEM },
      ...history.slice(-6).map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) })),
      { role: "user", content: `Excerpts from the document:\n\n${excerpts}\n\nQuestion: ${question}` },
    ];

    const stream = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.2,
      stream: true,
      messages,
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of stream) {
            const t = part.choices[0]?.delta?.content;
            if (t) controller.enqueue(encoder.encode(t));
          }
        } catch (e) {
          controller.enqueue(encoder.encode("\n\n[The response was interrupted.]"));
        }
        controller.close();
      },
    });

    return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (err) {
    console.error(err);
    return new Response("Something went wrong generating the answer.", { status: 500 });
  }
}
