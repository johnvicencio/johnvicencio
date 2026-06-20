import { getStore } from "@netlify/blobs";

const allowedNames = new Set(["pages", "posts", "settings"]);

export default async (request: Request) => {
  if (request.method === "OPTIONS") return empty(204);

  const url = new URL(request.url);
  const name = url.searchParams.get("name") ?? "";

  if (!allowedNames.has(name)) {
    return json({ error: "Unknown content name" }, 400);
  }

  const store = getStore("content");
  const key = `${name}.json`;

  if (request.method === "GET") {
    const body = await store.get(key, { type: "text" });
    if (!body) return json({ error: "Content not found" }, 404);
    return new Response(body, headers(200));
  }

  if (request.method === "PUT") {
    const token = process.env.CONTENT_WRITE_TOKEN;
    if (!token) return json({ error: "CONTENT_WRITE_TOKEN is not configured" }, 403);

    const given = request.headers.get("x-content-token") ?? "";
    if (given !== token) return json({ error: "Unauthorized" }, 401);

    const body = await request.text();
    JSON.parse(body);
    await store.set(key, body, { metadata: { updatedAt: new Date().toISOString() } });
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};

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
