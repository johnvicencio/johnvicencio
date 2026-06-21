import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const imageRoot = path.join(projectRoot, "wwwroot", "images");
const staticIndexPath = path.join(imageRoot, "index.json");
const functionIndexPath = path.join(projectRoot, "netlify", "functions", "image-index.json");
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico"]);

const images = [];

walk(imageRoot);
images.sort((a, b) => a.Folder.localeCompare(b.Folder) || a.FileName.localeCompare(b.FileName));

fs.writeFileSync(staticIndexPath, `${JSON.stringify(images, null, 2)}\n`);
fs.writeFileSync(functionIndexPath, `${JSON.stringify(images, null, 2)}\n`);

console.log(`Generated image index with ${images.length} image(s).`);

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!imageExtensions.has(extension) || entry.name === "index.json") continue;

    const relativePath = path.relative(imageRoot, fullPath).split(path.sep).join("/");
    const stat = fs.statSync(fullPath);
    images.push({
      FileName: path.basename(relativePath),
      Url: `/images/${relativePath}`,
      Folder: path.dirname(relativePath) === "." ? "" : path.dirname(relativePath),
      ContentType: contentType(extension),
      Size: stat.size,
      UploadedUtc: stat.mtime.toISOString(),
    });
  }
}

function contentType(extension) {
  if (extension === ".png") return "image/png";
  if (extension === ".gif") return "image/gif";
  if (extension === ".webp") return "image/webp";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".ico") return "image/x-icon";
  return "image/jpeg";
}
