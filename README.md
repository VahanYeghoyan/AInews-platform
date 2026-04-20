# AI News

A personalized, AI-powered news aggregator built with Next.js. It fetches articles from dozens of sources, classifies them automatically, and lets you chat with your feed using a local LLM.

## Features

- Personalized feed filtered by topics, sources, and languages
- Bookmarks, search, and trending articles
- Daily email digests
- User authentication (register / login)
- Multi-language support (English, Armenian, and more)

## AI Features

### Pulse Assistant — Conversational Chat (RAG + Ollama)
A floating chat widget lets you ask questions about your news feed in natural language. Examples:
- *"Summarize today's top stories"*
- *"What's the latest in technology?"*

Powered by **Ollama** running locally (default model: `llama3`). Responses are streamed in real time via Server-Sent Events. The assistant uses **Retrieval-Augmented Generation (RAG)**: before answering, it fetches articles from your feed that are relevant to your query and passes them as context to the LLM — so answers are grounded in real, up-to-date news.

Configure via environment variables:
```
OLLAMA_URL=http://localhost:11434   # default
OLLAMA_MODEL=llama3                 # default
```

### RAG System (`src/lib/rag.ts`)
Retrieves articles relevant to a user query using **PostgreSQL full-text search** (`tsvector` / `tsquery`), filtered by the user's selected topics, sources, and languages. Results from the last 24 hours are ranked by relevance and injected into the LLM prompt.

### Automatic Topic Classification (`src/lib/news-fetcher.ts`)
Every ingested article is automatically classified into one of these topics:
`Technology`, `Business`, `Sports`, `Health`, `Science`, `Entertainment`, `General`

Classification uses a keyword-scoring algorithm — the topic whose keywords score highest wins. AI-specific keywords like `"artificial intelligence"`, `"machine learning"`, and `"openai"` are included in the Technology category.

### Language Detection (`tinyld`)
Each article's language is detected automatically at ingestion time using the **tinyld** library. This powers the per-language feed filter.

### Full-Text Search
Search across all articles using PostgreSQL's native full-text search engine. Results are ranked by `ts_rank()` relevance and filtered by the user's preferences.

### Trending Detection
Articles are ranked by click-through count over the last 24 hours to surface what's trending in your feed.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Database | PostgreSQL + Prisma ORM |
| LLM Runtime | Ollama (local, privacy-first) |
| Language Detection | tinyld |
| News Sources | RSS feeds + web scraping (cheerio) |
| Auth | JWT / bcrypt |
| Email | Nodemailer |

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL
- [Ollama](https://ollama.ai) installed and running with `llama3` pulled

```bash
ollama pull llama3
```

### Install & Run

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, OLLAMA_URL, etc.
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Fetch Fresh News

```bash
npm run fetch-news
```

## Environment Variables

```
DATABASE_URL=
NEXTAUTH_SECRET=
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

## Deploy on Vercel

See the [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying).  
For the AI chat feature you will need a reachable Ollama instance or swap the `OLLAMA_URL` for a hosted LLM endpoint.
