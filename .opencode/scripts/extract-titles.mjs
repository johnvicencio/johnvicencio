import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const CSV_OUT = path.join(ROOT, ".opencode", "scripts", "post-titles.csv");
const TMP_FILE = path.join(ROOT, ".opencode", "scripts", "posts-data.json");

function fetchBlob() {
  const result = spawnSync("netlify", ["blobs:get", "content", "posts.json"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  if (result.error) {
    console.error("Failed to fetch blob:", result.error.message);
    process.exit(1);
  }
  fs.writeFileSync(TMP_FILE, result.stdout, "utf8");
  return JSON.parse(result.stdout);
}

function generateCSV(posts) {
  const rows = [["Index", "Id", "PublishedOn", "Slug", "Title", "Summary"]];
  posts.forEach((p, i) => {
    const safe = (s) => `"${(s ?? "").replace(/"/g, '""')}"`;
    rows.push(
      [i + 1, safe(p.Id), p.PublishedOn, safe(p.Slug), safe(p.Title), safe(p.Summary)].join(",")
    );
  });
  return rows.join("\n");
}

function analyzePatterns(posts) {
  const openings = new Map();
  const firstTwoWords = new Map();
  const endingPatterns = new Map();
  const titleWords = new Map();

  for (const p of posts) {
    const t = p.Title;

    // Opening word
    const first = t.match(/^([A-Z][a-z]+)\b/);
    if (first) {
      openings.set(first[1], (openings.get(first[1]) ?? 0) + 1);
    }

    // First two words
    const words = t.split(/\s+/);
    if (words.length >= 2) {
      const pair = words.slice(0, 2).join(" ").replace(/[^a-zA-Z\s-]/g, "").trim();
      if (pair.length > 2) {
        firstTwoWords.set(pair, (firstTwoWords.get(pair) ?? 0) + 1);
      }
    }

    // Last 3 words
    if (words.length >= 3) {
      const ending = words.slice(-3).join(" ").replace(/[^a-zA-Z\s-]/g, "").trim();
      if (ending.length > 5) {
        endingPatterns.set(ending, (endingPatterns.get(ending) ?? 0) + 1);
      }
    }
  }

  console.log("\n=== Title Opening Word Frequency ===");
  [...openings.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, c]) => c > 1)
    .forEach(([w, c]) => console.log(`  "${w}" x ${c}`));

  console.log("\n=== Most Repeated Opening Word Pairs (top 15) ===");
  [...firstTwoWords.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([w, c]) => console.log(`  "${w}" x ${c}`));

  console.log("\n=== Most Repeated Ending 3-Word Patterns (top 15) ===");
  [...endingPatterns.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([w, c]) => console.log(`  "${w}" x ${c}`));

  console.log("\n=== Sample Titles with Repetitive Endings ===");
  const badEndings = ["the industry", "the web", "the browser", "the platform"];
  let shown = 0;
  for (const p of posts) {
    const t = p.Title.toLowerCase();
    if (badEndings.some((e) => t.includes(e)) && shown < 10) {
      console.log(`  [${p.PublishedOn}] ${p.Title}`);
      shown++;
    }
  }
}

function main() {
  console.log("Fetching 850 posts from Netlify Blobs...");
  const posts = fetchBlob();
  console.log(`Loaded ${posts.length} posts.`);

  const csv = generateCSV(posts);
  fs.writeFileSync(CSV_OUT, csv, "utf8");
  console.log(`\nCSV written to ${CSV_OUT}`);
  console.log(`Raw JSON cached at ${TMP_FILE}`);

  analyzePatterns(posts);
}

main();
