import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const CACHE_FILE = path.join(ROOT, ".opencode", "scripts", "posts-data.json");
const CSV_FILE = path.join(ROOT, ".opencode", "scripts", "post-titles.csv");
const OUTPUT_FILE = path.join(ROOT, ".opencode", "scripts", "posts-regenerated.json");

if (!fs.existsSync(CACHE_FILE)) {
  console.error("Missing posts-data.json. Run extract-titles.mjs first.");
  process.exit(1);
}

const posts = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function loadEdits() {
  const csv = fs.readFileSync(CSV_FILE, "utf8");
  const lines = csv.split("\n").filter((l) => l.trim());
  const header = parseCSVLine(lines[0]);

  // Find column indices
  const titleIdx = header.indexOf("NewTitle");
  const descIdx = header.indexOf("NewDescription");
  const idIdx = header.indexOf("Id");

  if (titleIdx === -1 || descIdx === -1) {
    console.error("CSV must have NewTitle and NewDescription columns");
    console.error(`Found columns: ${header.join(", ")}`);
    process.exit(1);
  }

  const edits = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length <= Math.max(titleIdx, descIdx)) continue;
    const id = cols[idIdx].replace(/^"|"$/g, "");
    const title = cols[titleIdx]?.replace(/^"|"$/g, "").trim();
    const desc = cols[descIdx]?.replace(/^"|"$/g, "").trim();
    if (title || desc) {
      edits.set(id, { title, description: desc });
    }
  }
  return edits;
}

function pushToNetlify(updatedPosts) {
  const json = JSON.stringify(updatedPosts, null, 2);
  const tmpFile = path.join(ROOT, ".opencode", "scripts", "_push.json");
  fs.writeFileSync(tmpFile, json, "utf8");

  console.log("Pushing updated posts to Netlify Blobs...");
  const result = spawnSync("netlify", ["blobs:set", "content", "posts.json", "--input", tmpFile], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });

  if (result.error) {
    console.error("Push failed:", result.error.message);
    process.exit(1);
  }
  console.log(result.stdout);
  fs.unlinkSync(tmpFile);
}

function main() {
  const edits = loadEdits();
  console.log(`Found ${edits.size} posts with edits to apply.\n`);

  let updatedCount = 0;
  const updatedPosts = posts.map((post) => {
    const edit = edits.get(post.Id);
    if (!edit || (!edit.title && !edit.description)) return post;

    updatedCount++;
    return {
      ...post,
      Title: edit.title || post.Title,
      Description: edit.description || post.Description,
      Summary: edit.description || post.Summary,
    };
  });

  console.log(`Applied ${updatedCount} title/description updates.`);

  // Save to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(updatedPosts, null, 2), "utf8");
  console.log(`Regenerated data saved to ${OUTPUT_FILE}`);

  // Push to Netlify
  pushToNetlify(updatedPosts);

  console.log("\nDone.");
}

main();
