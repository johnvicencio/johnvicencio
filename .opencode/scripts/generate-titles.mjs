import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const CACHE_FILE = path.join(ROOT, ".opencode", "scripts", "posts-data.json");
const CSV_FILE = path.join(ROOT, ".opencode", "scripts", "post-titles.csv");
const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "llama3.1:latest";

if (!fs.existsSync(CACHE_FILE)) {
  console.error("Missing posts-data.json. Run extract-titles.mjs first.");
  process.exit(1);
}

const posts = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));

// Load existing edits from CSV so we skip already-done posts
function loadExistingEdits() {
  if (!fs.existsSync(CSV_FILE)) return new Map();
  const csv = fs.readFileSync(CSV_FILE, "utf8");
  const lines = csv.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return new Map();
  const header = lines[0].split(",").map((h) => h.replace(/^"|"$/g, ""));
  const idIdx = header.indexOf("Id");
  const titleIdx = header.indexOf("NewTitle");
  if (idIdx === -1 || titleIdx === -1) return new Map();

  const edits = new Map();
  for (let i = 1; i < lines.length; i++) {
    const parts = [];
    let current = "";
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { parts.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    parts.push(current.trim());
    const id = parts[idIdx]?.replace(/^"|"$/g, "");
    const title = parts[titleIdx]?.replace(/^"|"$/g, "");
    if (id && title) edits.set(id, true);
  }
  return edits;
}

const existingEdits = loadExistingEdits();
console.log(`Found ${existingEdits.size} already-edited posts (will skip).\n`);

// System-level instructions
const SYSTEM = `You are a senior technology editor at a professional publication. Your job is to rewrite blog post metadata to be original, human, and publication-ready.

Rules:
- Title must be completely unique from every other title.
- Never start with: The, How, Why, What, When, Who, A, An
- Never use: Is What Happened, Here Is Why, All These Years, At What Cost, The Industry Changed, The Platform Matured
- Vary the style. No formulaic patterns.
- No years in title. No em dashes. No clickbait. No AI cliches.
- Description: concise, unique, accurate summary.
- Output exactly: title on one line, description on next line. No labels. No preamble.
`;

function buildPrompt(post, isPersonal) {
  const text = post.Content
    .replace(/<[^>]+>/g, " ")
    .replace(/<a\s+[^>]*href="([^"]+)"[^>]*>.*?<\/a>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);

  if (isPersonal) {
    return `This is a personal career timeline post for John Vicencio. Rewrite the title and SEO description with natural, human phrasing.

Current title: "${post.Title}"
Current description: "${post.Description || post.Summary}"

Content excerpt: ${text}`;
  }

  return `Rewrite this technology history blog post title and SEO description. The title must be completely original and unlike any other title in the series.

Current title: "${post.Title}"
Current description: "${post.Description || post.Summary}"

Content excerpt: ${text}`;
}

async function callOllama(prompt) {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt: `${SYSTEM}\n\n${prompt}`,
      stream: false,
      options: {
        temperature: 0.8,
        num_predict: 100,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.response.trim();
}

function cleanTitle(raw) {
  let t = raw
    .replace(/\([^)]*\)/g, "")
    .replace(/[*]{2}/g, "")
    .replace(/[.,:;!]+$/, "")
    .trim();
  return t;
}

function parseResponse(text, post) {
  let clean = text
    .replace(/^(Here|Below|I'?ve|Let me|Please find|Attached|Following|The rewritten|Rewritten|New title|Note:)[^:]*:?\s*/i, "")
    .replace(/^(Title|SEO Description|Description):\s*/gim, "")
    .replace(/^["'\-\s]+|["'\-\s]+$/gm, "")
    .replace(/[*]{2}/g, "")
    .trim();

  // Split on newlines first
  const lines = clean.split("\n").filter((l) => l.trim());
  let title = "";
  let description = "";

  if (lines.length >= 2) {
    title = cleanTitle(lines[0]);
    description = lines.slice(1).join(" ").replace(/^["'\-\s]+|["'\-\s]+$/g, "").trim();
    return { title, description: description || post.Description || post.Summary };
  }

  // Single line. Try to split on "Title." + Capital letter (sentence boundary)
  const sentenceSplit = clean.match(/^([^.]+\.)\s*([A-Z].*)$/);
  if (sentenceSplit) {
    title = cleanTitle(sentenceSplit[1]);
    description = sentenceSplit[2].trim();
    return { title, description };
  }

  // Try to split on camelCase boundary (word ending lowercase directly adjacent to Capital)
  // e.g. "Web Architecture Finds Its BalanceAs browser APIs expanded"
  const camelSplit = clean.match(/^([a-zA-Z\s,;:'"-]+)([A-Z][a-z]+.*)$/);
  if (camelSplit) {
    const first = camelSplit[1].trim();
    const second = camelSplit[2].trim();
    if (first.length > 10 && first.length < 100) {
      title = cleanTitle(first);
      description = second;
      return { title, description };
    }
  }

  // Last resort: use first 15 words as title
  const words = clean.split(/\s+/);
  if (words.length > 15) {
    title = cleanTitle(words.slice(0, 15).join(" "));
    description = words.slice(15).join(" ");
    return { title, description };
  }

  return { title: post.Title, description: post.Description || post.Summary };
}

function escapeCSV(s) {
  if (!s) return "";
  return `"${s.replace(/"/g, '""')}"`;
}

function writeCSV(posts, results) {
  const lines = [["Index", "Id", "PublishedOn", "Slug", "OldTitle", "NewTitle", "NewDescription"]];
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const r = results.get(p.Id);
    lines.push([
      i + 1,
      escapeCSV(p.Id),
      p.PublishedOn,
      escapeCSV(p.Slug),
      escapeCSV(p.Title),
      escapeCSV(r?.title ?? ""),
      escapeCSV(r?.description ?? ""),
    ].join(","));
  }
  fs.writeFileSync(CSV_FILE, lines.join("\n"), "utf8");
}

async function main() {
  const batchSize = 5;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const results = new Map();
  const usedTitles = new Set();
  const usedDescs = new Set();

  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize);
    console.log(`Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(posts.length / batchSize)} (posts ${i + 1}-${Math.min(i + batchSize, posts.length)})...`);

    const promises = batch.map(async (post) => {
      if (existingEdits.has(post.Id)) {
        results.set(post.Id, { title: post.Title, description: post.Description || post.Summary });
        skipped++;
        return;
      }

      const isPersonal = (post.Keywords ?? "").includes("timeline") || post.Slug.startsWith("exp");

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const prompt = buildPrompt(post, isPersonal);
          const raw = await callOllama(prompt);
          const parsed = parseResponse(raw, post);

          // Validate: reject only if clearly broken (empty or same as original)
          const badStarts = /^(the|how|why|what|when|who|a|an)\s/i;
          if (parsed.title === post.Title) {
            console.log(`  Retry ${attempt + 1}: unchanged "${parsed.title.slice(0, 60)}..."`);
            continue;
          }
          if (badStarts.test(parsed.title)) {
            console.log(`  Retry ${attempt + 1}: bad start "${parsed.title.slice(0, 50)}..."`);
            continue;
          }

          const badPhrases = [
            "is what happened", "here is why", "all these years", "at what cost",
            "the industry changed", "the platform matured",
          ];
          const lower = parsed.title.toLowerCase();
          if (badPhrases.some((p) => lower.includes(p))) {
            console.log(`  Retry ${attempt + 1}: bad phrase in "${parsed.title.slice(0, 50)}..."`);
            continue;
          }

          if (usedTitles.has(parsed.title.toLowerCase())) {
            console.log(`  Retry ${attempt + 1}: duplicate title "${parsed.title.slice(0, 50)}..."`);
            continue;
          }

          usedTitles.add(parsed.title.toLowerCase());
          usedDescs.add(parsed.description.toLowerCase());
          results.set(post.Id, parsed);
          updated++;
          return;
        } catch (err) {
          console.log(`  Error (attempt ${attempt + 1}): ${err.message}`);
        }
      }

      // Fall back to original if all retries fail
      results.set(post.Id, { title: post.Title, description: post.Description || post.Summary });
      failed++;
      console.log(`  Failed after 3 attempts, keeping original title for "${post.Title.slice(0, 50)}..."`);
    });

    await Promise.allSettled(promises);

    // Write progress after each batch
    writeCSV(posts, results);
    console.log(`  Progress: ${updated} updated, ${skipped} skipped, ${failed} failed so far\n`);
  }

  console.log(`\nDone. ${updated} updated, ${skipped} skipped, ${failed} failed.`);
  console.log(`CSV written to ${CSV_FILE}`);

  if (updated > 0) {
    console.log("\nRun: node .opencode/scripts/apply-titles.mjs");
    console.log("to push the updated titles to Netlify Blobs.");
  }
}

main().catch(console.error);
