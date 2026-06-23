import { getStore } from "@netlify/blobs";

const LOG_KEY = "app-logs.json";
const RATE_KEY = "app-log-rate-limits.json";
const MAX_LOG_ENTRIES = 500;
const MAX_PUBLIC_LOGS_PER_HOUR = 40;

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

  if (request.method === "POST") {
    const store = getStore("content");
    const rate = await checkPublicRateLimit(store, request);
    if (!rate.ok) return json({ error: "Too many log entries" }, 429);

    const entry = await readRequestJson(request);
    const existing = await readLogs(store);
    existing.unshift({
      timestamp: new Date().toISOString(),
      level: "error",
      source: clean(entry.source, 120) || "Browser",
      message: clean(entry.message, 2000) || "Browser error",
      context: JSON.stringify({
        url: clean(entry.url, 500),
        file: clean(entry.file, 500),
        line: toSafeNumber(entry.line),
        column: toSafeNumber(entry.column),
        stack: clean(entry.stack, 2000),
        userAgent: clean(request.headers.get("user-agent"), 240),
      }),
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

async function readRequestJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function readLogs(store: ReturnType<typeof getStore>) {
  const body = await store.get(LOG_KEY, { type: "text" });
  if (!body) return [];
  return JSON.parse(body);
}

async function checkPublicRateLimit(store: ReturnType<typeof getStore>, request: Request) {
  const now = Date.now();
  const key = await sha256([
    request.headers.get("x-nf-client-connection-ip"),
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    request.headers.get("client-ip"),
    request.headers.get("user-agent"),
  ].filter(Boolean).join("|") || "unknown");
  const body = await store.get(RATE_KEY, { type: "text" });
  const state = body ? JSON.parse(body) as Record<string, number[]> : {};
  const recent = (state[key] ?? []).filter((time) => now - time < 60 * 60 * 1000);
  recent.push(now);
  state[key] = recent.slice(-MAX_PUBLIC_LOGS_PER_HOUR);

  for (const item of Object.keys(state)) {
    state[item] = state[item].filter((time) => now - time < 60 * 60 * 1000);
    if (state[item].length === 0) delete state[item];
  }

  await store.set(RATE_KEY, JSON.stringify(state), { metadata: { updatedAt: new Date().toISOString() } });
  return { ok: recent.length <= MAX_PUBLIC_LOGS_PER_HOUR };
}

function clean(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value
    .replace(/CONTENT_WRITE_TOKEN|SETTINGS_ENCRYPTION_KEY/gi, "[redacted]")
    .replace(/(token|password|secret|key)=([^&\s]+)/gi, "$1=[redacted]")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function toSafeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : null;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(digest).toString("hex");
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
      "access-control-allow-methods": "GET,PUT,POST,OPTIONS",
      "access-control-allow-headers": "content-type,x-content-token",
    },
  };
}
