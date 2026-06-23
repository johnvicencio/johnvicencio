import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const CACHE_FILE = path.join(ROOT, ".opencode", "scripts", "posts-data.json");
const OUTPUT_FILE = path.join(ROOT, ".opencode", "scripts", "posts-regenerated.json");
const REPORT_FILE = path.join(ROOT, ".opencode", "scripts", "regeneration-report.csv");
const USED_TITLES = new Set();
const USED_DESCRIPTIONS = new Set();

if (!fs.existsSync(CACHE_FILE)) {
  console.error("Run extract-titles.mjs first to cache posts.json");
  process.exit(1);
}

const posts = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
console.log(`Loaded ${posts.length} posts for title regeneration.\n`);

// Editorial guidelines as a system prompt
const SYSTEM_PROMPT = `You are an experienced technology journalist rewriting blog post metadata for a professional software engineering publication. Each post is about web development history.

RULES:
- Every title must be UNIQUE. Never reuse wording, structure, metaphor, framing, or grammatical pattern.
- Never start with "The", "How", "Why", "What", "When", "Who" as the first word.
- Vary styles: narrative, analytical, reflective, contrarian, technical, historical.
- No timeline phrasing (no months, years, dates in titles).
- No em dashes.
- No clickbait. No AI clichés.
- Sound like a human editor, not a content mill.
- SEO description must be concise, natural, unique, and accurately summarize the article.
- Return ONLY: Title\\nDescription`;

const timingLog = [];

function markTiming(label) {
  timingLog.push(`${new Date().toISOString()} | ${label}`);
}

function getSystemPromptForPersonalPost(post) {
  const jobKeywords = post.Keywords ?? "";
  const isPersonal = jobKeywords.includes("timeline") || post.Id.length < 8 || post.Slug.includes("exp20");
  return isPersonal ? `This is a personal career timeline post for John Vicencio. Write a title and SEO description that is narrative and human. Do not use "The", "How", "Why", "What", "When", "Who" as the first word. No dates in the title.` : SYSTEM_PROMPT;
}

function validateTitle(title, index) {
  const failures = [];

  const badStarts = ["the ", "how ", "why ", "what ", "when ", "who ", "a ", "an "];
  if (badStarts.some((s) => title.toLowerCase().startsWith(s))) {
    failures.push(`Starts with forbidden word: "${title.split(" ")[0]}"`);
  }

  if (USED_TITLES.has(title.toLowerCase())) {
    failures.push("Duplicate title");
  }

  const badPhrases = [
    "is what happened", "here is why", "all these years", "at what cost",
    "the industry changed", "the platform matured", "new patterns emerged",
    "old assumptions broke", "the ecosystem shifted", "what developers gained",
    "new era began", "lessons were learned", "the debate continued",
    "the community divided", "the browser platform",
  ];
  const lower = title.toLowerCase();
  for (const bp of badPhrases) {
    if (lower.includes(bp)) {
      failures.push(`Contains forbidden phrase: "${bp}"`);
    }
  }

  if (/\b\d{4}\b/.test(title) && !title.includes("JavaScript") && !title.includes("HTML")) {
    failures.push("Contains year in title");
  }

  return failures;
}

function validateDescription(desc, index) {
  const failures = [];
  if (USED_DESCRIPTIONS.has(desc.toLowerCase())) {
    failures.push("Duplicate description");
  }
  const cliches = [
    "in today's rapidly", "as technology continues", "it is important to note",
    "needless to say", "the future of", "in conclusion", "this highlights the importance",
    "rapidly evolving", "ever-changing",
  ];
  const lower = desc.toLowerCase();
  for (const c of cliches) {
    if (lower.includes(c)) {
      failures.push(`Contains cliche: "${c}"`);
    }
  }
  return failures;
}

let totalTokens = 0;
let totalCost = 0;

async function generatePostMetadata(post, index) {
  const { Title: oldTitle, Summary: oldSummary, Content: oldContent, PublishedOn, Keywords, Slug } = post;

  // Extract a plain text excerpt (strip HTML)
  const plainText = oldContent
    .replace(/<[^>]+>/g, " ")
    .replace(/<a\s+[^>]*href="([^"]+)"[^>]*>.*?<\/a>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const excerpt = plainText.slice(0, 1500);
  const isPersonal = (Keywords ?? "").includes("timeline") || Slug.startsWith("exp");
  const prompt = isPersonal
    ? `This is a personal career experience post. Rewrite the title and description. Current: "${oldTitle}". Content: "${excerpt}"`
    : `Rewrite this technology history blog post title and SEO description with UNIQUE phrasing not used in any other title. Current title: "${oldTitle}". Current summary: "${oldSummary}". Content excerpt: "${excerpt}"`;

  // Use netlify or local AI? For now, we'll use the existing opencode agent
  // Since we can't call an external API from here, we'll output a structured batch file
  // for processing with an external tool

  return {
    prompt,
    oldTitle,
    oldSummary,
    isPersonal,
    contentExcerpt: excerpt.slice(0, 200),
  };
}

async function main() {
  markTiming("Start");

  // Build the batch file for external processing
  const batch = [];
  let personalCount = 0;
  let techCount = 0;

  for (let i = 0; i < posts.length; i++) {
    const meta = await generatePostMetadata(posts[i], i);
    batch.push(meta);
    if (meta.isPersonal) personalCount++;
    else techCount++;
  }

  const batchFile = path.join(ROOT, ".opencode", "scripts", "batch-input.json");
  fs.writeFileSync(batchFile, JSON.stringify(batch, null, 2), "utf8");

  console.log(`Posts: ${posts.length} total (${personalCount} personal, ${techCount} technology history)`);
  console.log(`\nBatch input written to ${batchFile}`);

  // Also create a CSV template for easy manual editing
  const csvRows = [["Index", "Id", "PublishedOn", "OldTitle", "NewTitle", "NewDescription"]];
  for (let i = 0; i < posts.length; i++) {
    csvRows.push([
      i + 1,
      posts[i].Id,
      posts[i].PublishedOn,
      `"${posts[i].Title.replace(/"/g, '""')}"`,
      "",
      "",
    ].join(","));
  }
  fs.writeFileSync(REPORT_FILE, csvRows.join("\n"), "utf8");
  console.log(`CSV template written to ${REPORT_FILE}`);

  console.log("\n--- HOW TO USE ---");
  console.log("1. Edit .opencode/scripts/batch-input.json or post-titles.csv with new titles and descriptions");
  console.log("2. The CSV has empty 'NewTitle' and 'NewDescription' columns for you to fill in");
  console.log("3. Run: node .opencode/scripts/apply-titles.mjs to apply your edits and push to Netlify");

  markTiming("Done");
  console.log(`\nTiming log:\n${timingLog.join("\n")}`);
}

main().catch(console.error);
