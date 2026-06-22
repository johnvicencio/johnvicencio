import fs from "node:fs/promises";

export default async () => {
  const indexUrl = new URL("./image-index.json", import.meta.url);

  try {
    const body = await fs.readFile(indexUrl, "utf8");
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};
