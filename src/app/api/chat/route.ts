import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { retrieveArticles, getRecentArticles, formatContext } from "@/lib/rag";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const userId = (session.user as { id: string }).id;
  const { message, history } = await req.json();

  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
    });
  }

  // RAG: retrieve relevant articles
  let articles = await retrieveArticles(userId, message, 5);
  if (articles.length === 0) {
    articles = await getRecentArticles(userId, 5);
  }
  const context = formatContext(articles);

  // Build conversation for Ollama
  const systemPrompt = `You are Pulse Assistant, a helpful news assistant. You answer user questions based on their personalized news feed. Use the retrieved articles below as your knowledge base. When referencing an article, mention its title and source. If the articles don't contain enough information to answer, say so honestly. Keep answers concise and informative.

RETRIEVED ARTICLES:
${context}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...(history || []).slice(-6), // keep last 6 messages for context window
    { role: "user", content: message },
  ];

  // Stream response from Ollama
  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: true,
      }),
    });

    if (!ollamaRes.ok) {
      const err = await ollamaRes.text();
      return new Response(
        JSON.stringify({ error: `Ollama error: ${err}` }),
        { status: 502 }
      );
    }

    // Transform Ollama's NDJSON stream into a readable stream for the client
    const reader = ollamaRes.body!.getReader();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line);
              if (json.message?.content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ token: json.message.content })}\n\n`)
                );
              }
              if (json.done) {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {
              // skip malformed lines
            }
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to connect to Ollama";
    return new Response(JSON.stringify({ error: message }), { status: 502 });
  }
}
