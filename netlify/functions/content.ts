import { getStore } from "@netlify/blobs";

const allowedNames = new Set(["pages", "posts", "settings", "messages", "contact-rate-limits"]);

export default async (request: Request) => {
  if (request.method === "OPTIONS") return empty(204);

  const url = new URL(request.url);
  const name = url.searchParams.get("name") ?? "";

  if (!isAllowedName(name)) {
    return json({ error: "Unknown content name" }, 400);
  }

  const store = getStore("content");
  const key = `${name}.json`;

  if (request.method === "GET") {
    const body = await store.get(key, { type: "text" });
    if (!body) return json({ error: "Content not found" }, 404);
    if (name === "settings") {
      return new Response(scrubSettingsForClient(body), headers(200));
    }

    return new Response(body, headers(200));
  }

  if (request.method === "PUT") {
    const token = process.env.CONTENT_WRITE_TOKEN;
    if (!token) return json({ error: "CONTENT_WRITE_TOKEN is not configured" }, 403);

    const given = request.headers.get("x-content-token") ?? "";
    if (given !== token) return json({ error: "Unauthorized" }, 401);

    const body = await request.text();
    const storedBody = name === "settings"
      ? await prepareSettingsForStorage(body, await store.get(key, { type: "text" }))
      : validateJson(body);

    await store.set(key, storedBody, { metadata: { updatedAt: new Date().toISOString() } });
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

function isAllowedName(name: string) {
  if (allowedNames.has(name)) return true;
  return /^users\/[a-z0-9_-]+$/.test(name);
}

function validateJson(body: string) {
  rejectUnsafeStrings(JSON.parse(body));
  return body;
}

function scrubSettingsForClient(body: string) {
  const settings = JSON.parse(body);
  const encryptedPassword = typeof settings.SmtpPasswordEncrypted === "string" && settings.SmtpPasswordEncrypted.length > 0;
  const legacyPlainPassword = typeof settings.SmtpPassword === "string" && settings.SmtpPassword.length > 0 && !settings.SmtpPassword.startsWith("enc:v1:");

  settings.SmtpPasswordConfigured = encryptedPassword || legacyPlainPassword;
  settings.SmtpPassword = "";
  delete settings.SmtpPasswordEncrypted;

  return JSON.stringify(settings);
}

async function prepareSettingsForStorage(body: string, existingBody: string | null) {
  const settings = JSON.parse(body);
  rejectUnsafeStrings(settings, new Set(["SmtpPassword", "SmtpPasswordEncrypted"]));
  const existing = existingBody ? JSON.parse(existingBody) : {};
  const nextPassword = typeof settings.SmtpPassword === "string" ? settings.SmtpPassword.trim() : "";
  const existingEncrypted = typeof existing.SmtpPasswordEncrypted === "string" ? existing.SmtpPasswordEncrypted : "";
  const existingLegacyEncrypted = typeof existing.SmtpPassword === "string" && existing.SmtpPassword.startsWith("enc:v1:") ? existing.SmtpPassword : "";
  const existingLegacyPlain = typeof existing.SmtpPassword === "string" && existing.SmtpPassword.length > 0 && !existing.SmtpPassword.startsWith("enc:v1:")
    ? existing.SmtpPassword
    : "";

  if (nextPassword) {
    settings.SmtpPasswordEncrypted = await encryptSecret(nextPassword);
  } else if (existingEncrypted || existingLegacyEncrypted) {
    settings.SmtpPasswordEncrypted = existingEncrypted || existingLegacyEncrypted;
  } else if (existingLegacyPlain) {
    settings.SmtpPasswordEncrypted = await encryptSecret(existingLegacyPlain);
  } else {
    settings.SmtpPasswordEncrypted = "";
  }

  settings.SmtpPassword = "";
  settings.SmtpPasswordConfigured = Boolean(settings.SmtpPasswordEncrypted);

  return JSON.stringify(settings, null, 2);
}

async function encryptSecret(secret: string) {
  const keyMaterial = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!keyMaterial) {
    throw new Error("SETTINGS_ENCRYPTION_KEY is required to save SMTP passwords");
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(keyMaterial);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(secret));

  return `enc:v1:${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`;
}

async function deriveAesKey(keyMaterial: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(keyMaterial));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function rejectUnsafeStrings(value: unknown, skipKeys = new Set<string>()) {
  if (typeof value === "string") {
    if (hasUnsafeContent(value)) throw new Error("Content contains unsupported script-like input");
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) rejectUnsafeStrings(item, skipKeys);
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (skipKeys.has(key)) continue;
      rejectUnsafeStrings(item, skipKeys);
    }
  }
}

function hasUnsafeContent(value: string) {
  return /<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed|data\s*:/i.test(value);
}
