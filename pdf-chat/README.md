# Ask your PDF (RAG chatbot)

Upload a PDF, ask questions, get answers with page citations.

## How it works
1. `/api/upload` extracts text per page (unpdf), chunks it, and embeds the chunks (OpenAI `text-embedding-3-small`, 512 dims).
2. The browser keeps the chunks + vectors in memory (no database needed, which suits Vercel's stateless functions).
3. On each question the browser embeds the question (`/api/embed`), ranks chunks by cosine similarity, and sends the top 5 to `/api/chat`.
4. `/api/chat` streams a `gpt-4o-mini` answer grounded only in those excerpts, with `[p. N]` citations.

## Run locally
    npm install
    cp .env.example .env.local   # add your OPENAI_API_KEY
    npm run dev

## Deploy to Vercel
1. Push this folder to a GitHub repo.
2. vercel.com > Add New > Project > import the repo.
3. Settings > Environment Variables: add `OPENAI_API_KEY`.
4. Deploy.

## Limits
- PDF up to 4 MB (Vercel request body limit), up to 400 passages indexed.
- Scanned/image-only PDFs need OCR first.
- The index lives in the browser tab; refreshing the page clears it.
