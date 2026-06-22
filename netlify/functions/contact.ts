import { getStore } from "@netlify/blobs";
import nodemailer from "nodemailer";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  submittedUtc: string;
  isRead: boolean;
};

type SiteSettings = {
  SmtpHost?: string;
  SmtpPort?: number;
  SmtpUsername?: string;
  SmtpPasswordEncrypted?: string;
  FromEmail?: string;
  FromName?: string;
  ToEmail?: string;
};

type ContactInteraction = {
  elapsedMs?: number;
  keyboardEvents?: number;
  pasteEvents?: number;
  inputEvents?: number;
};

type RateState = Record<string, number[]>;

const key = "messages.json";
const rateKey = "contact-rate-limits.json";

export default async (request: Request) => {
  if (request.method === "OPTIONS") return empty(204);
  const url = new URL(request.url);

  if (request.method === "POST") {
    const input = await request.json();
    const name = clean(input.name, 120);
    const email = clean(input.email, 180);
    const message = clean(input.message, 4000);
    const website = clean(input.website, 180);
    const consentAccepted = input.consentAccepted === true;
    const interaction = normalizeInteraction(input.interaction);

    if (!name || !email || !message) {
      return json({ error: "Name, email, and message are required" }, 400);
    }

    if (website) return json({ error: "Submission rejected" }, 400);
    if (!consentAccepted) return json({ error: "Terms and privacy consent is required" }, 400);
    if ((interaction.elapsedMs ?? 0) < 2000) return json({ error: "Submission rejected" }, 400);
    if (!isValidEmail(email)) return json({ error: "Enter a valid email address" }, 400);
    if (hasUnsafeContent(name) || hasUnsafeContent(email) || hasUnsafeContent(message) || hasEncodedUnsafeContent(message)) {
      return json({ error: "Message contains unsupported content" }, 400);
    }
    if (countLinks(message) > 3) return json({ error: "Message contains too many links" }, 400);

    const store = getStore("content");
    const rateResult = await checkRateLimits(store, request, email, message);
    if (!rateResult.ok) return json({ error: rateResult.reason }, 429);

    const spam = scoreSpam({ name, email, message, interaction });
    if (spam.score >= 6) return json({ error: "Submission rejected" }, 400);

    const messages = await readMessages(store);
    messages.unshift({
      id: crypto.randomUUID(),
      name,
      email,
      message,
      submittedUtc: new Date().toISOString(),
      isRead: false,
    });

    const savedMessage = messages[0];
    await store.set(key, JSON.stringify(messages, null, 2), { metadata: { updatedAt: new Date().toISOString() } });

    const emailSent = await sendEmailNotification(store, savedMessage);
    return json({ ok: true, emailSent });
  }

  if (request.method === "GET") {
    const auth = authorize(request);
    if (auth) return auth;

    const store = getStore("content");
    return json(await readMessages(store));
  }

  if (request.method === "PATCH") {
    const auth = authorize(request);
    if (auth) return auth;

    const id = url.searchParams.get("id") ?? "";
    if (!id) return json({ error: "Message id is required" }, 400);

    const store = getStore("content");
    const messages = await readMessages(store);
    const message = messages.find((item) => item.id === id);
    if (!message) return json({ error: "Message not found" }, 404);

    message.isRead = true;
    await writeMessages(store, messages);
    return json({ ok: true });
  }

  if (request.method === "DELETE") {
    const auth = authorize(request);
    if (auth) return auth;

    const id = url.searchParams.get("id") ?? "";
    if (!id) return json({ error: "Message id is required" }, 400);

    const store = getStore("content");
    const messages = await readMessages(store);
    const updated = messages.filter((item) => item.id !== id);
    if (updated.length === messages.length) return json({ error: "Message not found" }, 404);

    await writeMessages(store, updated);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};

async function readMessages(store: ReturnType<typeof getStore>) {
  const body = await store.get(key, { type: "text" });
  if (!body) return [] as ContactMessage[];
  return JSON.parse(body) as ContactMessage[];
}

async function writeMessages(store: ReturnType<typeof getStore>, messages: ContactMessage[]) {
  await store.set(key, JSON.stringify(messages, null, 2), { metadata: { updatedAt: new Date().toISOString() } });
}

function authorize(request: Request) {
  const token = process.env.CONTENT_WRITE_TOKEN;
  if (!token) return json({ error: "CONTENT_WRITE_TOKEN is not configured" }, 403);

  const given = request.headers.get("x-content-token") ?? "";
  if (given !== token) return json({ error: "Unauthorized" }, 401);

  return null;
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isValidEmail(value: string) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

function hasUnsafeContent(value: string) {
  return /<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed|data\s*:/i.test(value);
}

function hasEncodedUnsafeContent(value: string) {
  const variants = new Set<string>([value]);
  let decoded = value;
  for (let i = 0; i < 3; i++) {
    try {
      decoded = decodeURIComponent(decoded);
      variants.add(decoded);
    } catch {
      break;
    }
  }

  variants.add(value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/&amp;/gi, "&"));

  return [...variants].some(hasUnsafeContent);
}

function countLinks(value: string) {
  return (value.match(/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|biz|info)\b/gi) ?? []).length;
}

function normalizeInteraction(value: unknown): ContactInteraction {
  if (!value || typeof value !== "object") return {};
  const input = value as ContactInteraction;
  return {
    elapsedMs: clampNumber(input.elapsedMs, 0, 60 * 60 * 1000),
    keyboardEvents: clampNumber(input.keyboardEvents, 0, 10000),
    pasteEvents: clampNumber(input.pasteEvents, 0, 10000),
    inputEvents: clampNumber(input.inputEvents, 0, 10000),
  };
}

function clampNumber(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.floor(value)))
    : undefined;
}

function scoreSpam(input: { name: string; email: string; message: string; interaction: ContactInteraction }) {
  const reasons: string[] = [];
  let score = 0;
  const elapsedMs = input.interaction.elapsedMs ?? 0;
  const keyboardEvents = input.interaction.keyboardEvents ?? 0;
  const pasteEvents = input.interaction.pasteEvents ?? 0;
  const inputEvents = input.interaction.inputEvents ?? 0;

  if (keyboardEvents === 0) addScore("no keyboard events", 2);
  if (pasteEvents > 0 && keyboardEvents <= 1) addScore("paste-heavy", 2);
  if (elapsedMs > 0 && elapsedMs < 5000) addScore("very short interaction", 1);
  if (inputEvents <= 2) addScore("low interaction", 1);
  if (uppercaseRatio(input.message) > 0.65 && input.message.length > 40) addScore("excessive capitalization", 1);
  if (hasSpamKeywords(input.message)) addScore("spam keywords", 2);
  if (hasRepeatedPhrases(input.message)) addScore("repeated phrases", 2);
  if (isSuspiciousEmail(input.email)) addScore("suspicious email", 1);

  return { score, reasons };

  function addScore(reason: string, points: number) {
    score += points;
    reasons.push(reason);
  }
}

function uppercaseRatio(value: string) {
  const letters = value.replace(/[^a-z]/gi, "");
  if (!letters) return 0;
  const uppercase = letters.replace(/[^A-Z]/g, "");
  return uppercase.length / letters.length;
}

function hasSpamKeywords(value: string) {
  return /\b(crypto|forex|casino|viagra|loan|payday|seo backlinks|guest post|whatsapp|telegram|investment opportunity)\b/i.test(value);
}

function hasRepeatedPhrases(value: string) {
  const words = value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  if (words.length < 12) return false;
  const counts = new Map<string, number>();
  for (let i = 0; i <= words.length - 3; i++) {
    const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    const next = (counts.get(phrase) ?? 0) + 1;
    if (next >= 3) return true;
    counts.set(phrase, next);
  }
  return false;
}

function isSuspiciousEmail(value: string) {
  const lower = value.toLowerCase();
  return /@(mailinator|10minutemail|tempmail|guerrillamail|yopmail|trashmail|sharklasers)\./.test(lower) ||
    /^[a-z0-9]{18,}@/.test(lower);
}

async function checkRateLimits(store: ReturnType<typeof getStore>, request: Request, email: string, message: string) {
  const state = await readRateState(store);
  const now = Date.now();
  const clientIp = request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("client-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const checks = [
    { key: `email:${await sha256(email.toLowerCase())}`, limit: 5, windowMs: 60 * 60 * 1000, reason: "Too many messages from this email" },
    { key: `message:${await sha256(normalizeMessageForHash(message))}`, limit: 3, windowMs: 24 * 60 * 60 * 1000, reason: "Repeated message submitted too often" },
    { key: `ip:${await sha256(clientIp)}`, limit: 20, windowMs: 60 * 60 * 1000, reason: "Too many messages from this network" },
    { key: `ua:${await sha256(userAgent)}`, limit: 30, windowMs: 60 * 60 * 1000, reason: "Too many messages from this browser" },
  ];

  let blockedReason = "";
  for (const check of checks) {
    const existing = (state[check.key] ?? []).filter((time) => now - time < check.windowMs);
    existing.push(now);
    state[check.key] = existing;
    if (existing.length > check.limit && !blockedReason) blockedReason = check.reason;
  }

  await writeRateState(store, state, now);
  return blockedReason ? { ok: false, reason: blockedReason } : { ok: true, reason: "" };
}

async function readRateState(store: ReturnType<typeof getStore>) {
  const body = await store.get(rateKey, { type: "text" });
  if (!body) return {} as RateState;
  return JSON.parse(body) as RateState;
}

async function writeRateState(store: ReturnType<typeof getStore>, state: RateState, now: number) {
  const maxAge = 24 * 60 * 60 * 1000;
  for (const key of Object.keys(state)) {
    state[key] = state[key].filter((time) => now - time < maxAge).slice(-100);
    if (state[key].length === 0) delete state[key];
  }
  await store.set(rateKey, JSON.stringify(state), { metadata: { updatedAt: new Date().toISOString() } });
}

function normalizeMessageForHash(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(digest).toString("hex");
}

async function sendEmailNotification(store: ReturnType<typeof getStore>, message: ContactMessage) {
  try {
    const settings = await readSettings(store);
    if (!settings?.SmtpHost || !settings.SmtpUsername || !settings.SmtpPasswordEncrypted || !settings.ToEmail) {
      console.warn("Contact email skipped: SMTP settings are incomplete");
      return false;
    }

    const password = await decryptSecret(settings.SmtpPasswordEncrypted);
    const fromEmail = settings.FromEmail || settings.SmtpUsername;
    const fromName = settings.FromName || "Website Contact";
    const transporter = nodemailer.createTransport({
      host: settings.SmtpHost,
      port: settings.SmtpPort || 587,
      secure: (settings.SmtpPort || 587) === 465,
      auth: {
        user: settings.SmtpUsername,
        pass: password,
      },
    });

    await transporter.sendMail({
      from: `"${escapeHeader(fromName)}" <${fromEmail}>`,
      to: settings.ToEmail,
      replyTo: message.email,
      subject: `New contact message from ${message.name}, ticket number ${Date.parse(message.submittedUtc)}`,
      text: `Name: ${message.name}\nEmail: ${message.email}\nSubmitted: ${message.submittedUtc}\n\n${message.message}`,
      html: `<p><strong>Name:</strong> ${escapeHtml(message.name)}</p><p><strong>Email:</strong> ${escapeHtml(message.email)}</p><p><strong>Submitted:</strong> ${escapeHtml(message.submittedUtc)}</p><hr><p>${escapeHtml(message.message).replaceAll("\n", "<br>")}</p>`,
    });

    return true;
  } catch (error) {
    console.error("Contact email failed", error);
    return false;
  }
}

async function readSettings(store: ReturnType<typeof getStore>) {
  const body = await store.get("settings.json", { type: "text" });
  if (!body) return null;
  return JSON.parse(body) as SiteSettings;
}

async function decryptSecret(encrypted: string) {
  const keyMaterial = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!keyMaterial) {
    throw new Error("SETTINGS_ENCRYPTION_KEY is required to send contact emails");
  }

  const [prefix, version, ivBase64, cipherBase64] = encrypted.split(":");
  if (prefix !== "enc" || version !== "v1" || !ivBase64 || !cipherBase64) {
    throw new Error("Unsupported encrypted SMTP password format");
  }

  const key = await deriveAesKey(keyMaterial);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivBase64) },
    key,
    fromBase64(cipherBase64),
  );

  return new TextDecoder().decode(plain);
}

async function deriveAesKey(keyMaterial: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(keyMaterial));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["decrypt"]);
}

function fromBase64(value: string) {
  return Buffer.from(value, "base64");
}

function escapeHeader(value: string) {
  return value.replace(/[\r\n"]/g, "").trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type,x-content-token",
    },
  };
}
