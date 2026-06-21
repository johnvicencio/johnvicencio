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

const key = "messages.json";

export default async (request: Request) => {
  if (request.method === "OPTIONS") return empty(204);
  const url = new URL(request.url);

  if (request.method === "POST") {
    const input = await request.json();
    const name = clean(input.name, 120);
    const email = clean(input.email, 180);
    const message = clean(input.message, 4000);
    const website = clean(input.website, 180);

    if (!name || !email || !message) {
      return json({ error: "Name, email, and message are required" }, 400);
    }

    if (website) return json({ ok: true, emailSent: false });
    if (!isValidEmail(email)) return json({ error: "Enter a valid email address" }, 400);
    if (hasUnsafeContent(name) || hasUnsafeContent(email) || hasUnsafeContent(message)) {
      return json({ error: "Message contains unsupported content" }, 400);
    }

    const store = getStore("content");
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
      subject: `New contact from johnvicencio.com ticket number: ${Date.parse(message.submittedUtc)}`,
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
