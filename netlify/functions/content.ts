import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getStore } from "@netlify/blobs";
import { authorizeWriteToken, corsHeaders, hasWriteToken } from "./_security";

const allowedNames = new Set(["pages", "posts", "settings", "messages", "contact-rate-limits"]);
const privateNames = new Set(["messages", "contact-rate-limits"]);
const METHODS = "GET,PUT,OPTIONS";

export default async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, METHODS) });
  }

  const url = new URL(request.url);
  const name = url.searchParams.get("name") ?? "";

  if (!isAllowedName(name)) {
    return json(request, { error: "Unknown content name" }, 400);
  }

  const store = getStore("content");
  const key = `${name}.json`;

  if (request.method === "GET") {
    // Messages / rate tables are private; pages/posts/settings/users stay readable for the public site + login vault.
    if (privateNames.has(name) && !hasWriteToken(request)) {
      return json(request, { error: "Unauthorized" }, 401);
    }

    let body = await store.get(key, { type: "text" });
    if (!body) body = await readLocalUserSeed(name);
    if (!body) return json(request, { error: "Content not found" }, 404);
    if (name === "settings") {
      return new Response(scrubSettingsForClient(body), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          ...corsHeaders(request, METHODS),
        },
      });
    }

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...corsHeaders(request, METHODS),
      },
    });
  }

  if (request.method === "PUT") {
    const auth = authorizeWriteToken(request, METHODS);
    if (auth) return auth;

    const body = await request.text();
    const storedBody = name === "settings"
      ? await prepareSettingsForStorage(body, await store.get(key, { type: "text" }))
      : validateJson(body);

    await store.set(key, storedBody, { metadata: { updatedAt: new Date().toISOString() } });
    return json(request, { ok: true });
  }

  return json(request, { error: "Method not allowed" }, 405);
};

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(request, METHODS),
    },
  });
}

function isAllowedName(name: string) {
  if (allowedNames.has(name)) return true;
  return /^users\/[a-z0-9_-]+$/.test(name);
}

/** Local netlify dev: serve wwwroot/data/users/{user}.json when Blobs are empty. Not published to CDN. */
async function readLocalUserSeed(name: string) {
  const match = /^users\/([a-z0-9_-]+)$/.exec(name);
  if (!match) return null;
  try {
    return await readFile(join(process.cwd(), "wwwroot/data/users", `${match[1]}.json`), "utf8");
  } catch {
    return null;
  }
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
