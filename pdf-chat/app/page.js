"use client";

import { useRef, useState, useEffect } from "react";

const TOP_K = 5;

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export default function Home() {
  const [doc, setDoc] = useState(null); // { name, totalPages, chunks }
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]); // { role, content, sources? }
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function handleFile(file) {
    if (!file) return;
    setError("");
    if (file.type !== "application/pdf") return setError("Choose a PDF file.");
    if (file.size > 4 * 1024 * 1024) return setError("This PDF is over 4 MB. Choose a smaller file.");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      setDoc(data);
      setMessages([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function ask(e) {
    e?.preventDefault();
    const question = input.trim();
    if (!question || busy || !doc) return;
    setInput("");
    setBusy(true);
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: question }, { role: "assistant", content: "" }]);

    try {
      // 1. embed the question
      const er = await fetch("/api/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: question }),
      });
      const { embedding, error: embErr } = await er.json();
      if (!er.ok) throw new Error(embErr || "Embedding failed.");

      // 2. retrieve top-k chunks in the browser
      const sources = doc.chunks
        .map((c) => ({ page: c.page, text: c.text, score: cosine(embedding, c.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_K);

      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "", sources };
        return copy;
      });

      // 3. stream the answer
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history,
          context: sources.map(({ page, text }) => ({ page, text })),
        }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: acc };
          return copy;
        });
      }
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "Error: " + err.message, failed: true };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <aside className="side">
        <h1>Ask your PDF</h1>
        <p className="lede">Upload a document, then ask questions. Every answer points to the page it came from.</p>

        <div
          className={"drop" + (dragging ? " drag" : "")}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {uploading ? (
            <p>Reading and indexing your PDF…</p>
          ) : doc ? (
            <>
              <p className="docname">{doc.name}</p>
              <p className="meta">{doc.totalPages} pages, {doc.chunks.length} passages indexed</p>
              <button className="ghost" onClick={() => fileRef.current?.click()}>Replace PDF</button>
            </>
          ) : (
            <>
              <p>Drop a PDF here</p>
              <button onClick={() => fileRef.current?.click()}>Choose PDF</button>
              <p className="meta">Up to 4 MB, text-based PDFs only</p>
            </>
          )}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </aside>

      <section className="chat">
        <div className="log">
          {messages.length === 0 && (
            <div className="empty">
              {doc ? "Ask anything about " + doc.name + "." : "Upload a PDF to start asking questions."}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={"msg " + m.role + (m.failed ? " failed" : "")}>
              <div className="bubble">{m.content || (busy && i === messages.length - 1 ? "Thinking…" : "")}</div>
              {m.sources && m.content && (
                <details className="sources">
                  <summary>Sources ({m.sources.length})</summary>
                  {m.sources.map((s, j) => (
                    <p key={j}>
                      <span className="page">p. {s.page}</span>
                      <mark>{s.text.length > 320 ? s.text.slice(0, 320) + "…" : s.text}</mark>
                    </p>
                  ))}
                </details>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form className="composer" onSubmit={ask}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={doc ? "Ask a question about the PDF" : "Upload a PDF first"}
            disabled={!doc || busy}
            aria-label="Your question"
          />
          <button type="submit" disabled={!doc || busy || !input.trim()}>Ask</button>
        </form>
      </section>
    </main>
  );
}
