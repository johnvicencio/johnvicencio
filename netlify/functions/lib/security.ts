import { timingSafeEqual } from "node:crypto";

const ALLOWED_ORIGINS = new Set([
  "https://johnvicencio.com",
  "https://www.johnvicencio.com",
  "http://localhost:8889",
  "http://localhost:4001",
  "http://127.0.0.1:8889",
  "http://127.0.0.1:4001",
]);

export function corsOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  if (/^https:\/\/[a-z0-9-]+--johnvicencio\.netlify\.app$/i.test(origin)) return origin;
  if (/^https:\/\/deploy-preview-\d+--johnvicencio\.netlify\.app$/i.test(origin)) return origin;
  return null;
}

export function corsHeaders(request: Request, methods: string) {
  const headers: Record<string, string> = {
    "access-control-allow-methods": methods,
    "access-control-allow-headers": "content-type,x-content-token",
    vary: "Origin",
  };
  const origin = corsOrigin(request);
  if (origin) headers["access-control-allow-origin"] = origin;
  return headers;
}

export function authorizeWriteToken(request: Request, methods = "GET,PUT,POST,PATCH,DELETE,OPTIONS"): Response | null {
  const token = process.env.CONTENT_WRITE_TOKEN;
  if (!token) {
    return jsonError(request, "CONTENT_WRITE_TOKEN is not configured", 403, methods);
  }

  const given = request.headers.get("x-content-token") ?? "";
  if (!safeEqual(given, token)) {
    return jsonError(request, "Unauthorized", 401, methods);
  }

  return null;
}

export function hasWriteToken(request: Request): boolean {
  const token = process.env.CONTENT_WRITE_TOKEN;
  if (!token) return false;
  return safeEqual(request.headers.get("x-content-token") ?? "", token);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function jsonError(request: Request, error: string, status: number, methods: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(request, methods),
    },
  });
}
