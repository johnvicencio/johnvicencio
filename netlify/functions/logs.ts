import { getStore } from "@netlify/blobs";

const LOG_KEY = "app-logs.json";
const MAX_LOG_ENTRIES = 500;

export default async (request: Request) => {
  if (request.method === "OPTIONS") return empty(204);

  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "";

  if (request.method === "PUT") {
    const token = process.env.CONTENT_WRITE_TOKEN;
    if (!token) return json({ error: "CONTENT_WRITE_TOKEN is not configured" }, 403);
    const given = request.headers.get("x-content-token") ?? "";
    if (given !== token) return json({ error: "Unauthorized" }, 401);

    const entry = await request.json();
    const store = getStore("content");
    const existing = await readLogs(store);
    existing.unshift({
      timestamp: new Date().toISOString(),
      level: entry.level ?? "info",
      source: entry.source ?? "unknown",
      message: entry.message ?? "",
      context: entry.context ?? null,
    });

    const trimmed = existing.slice(0, MAX_LOG_ENTRIES);
    await store.set(LOG_KEY, JSON.stringify(trimmed, null, 2), { metadata: { updatedAt: new Date().toISOString() } });
    return json({ ok: true });
  }

  if (request.method === "GET") {
    const token = process.env.CONTENT_WRITE_TOKEN;
    if (!token) return json({ error: "CONTENT_WRITE_TOKEN is not configured" }, 403);
    const given = request.headers.get("x-content-token") ?? "";
    if (given !== token) return json({ error: "Unauthorized" }, 401);

    const store = getStore("content");
    const logs = await readLogs(store);
    return json(logs);
  }

  return json({ error: "Method not allowed" }, 405);
};

async function readLogs(store: ReturnType<typeof getStore>) {
  const body = await store.get(LOG_KEY, { type: "text" });
  if (!body) return [];
  return JSON.parse(body);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), headers(status));
}

function empty(status: number) {
  return new Response(null, headers(status));
}

function headers(status: number) {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,PUT,OPTIONS",
      "access-control-allow-headers": "content-type,x-content-token",
    },
  };
}
