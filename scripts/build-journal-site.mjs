import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(rootDir, "journal-data.js");

async function collectMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(rootDir, fullPath);

    if (entry.isDirectory()) {
      if ([".git", "assets", "scripts"].includes(entry.name)) continue;
      files.push(...await collectMarkdownFiles(fullPath));
    } else if (/^\d{4}-\d{2}-\d{2}.*\.md$/.test(entry.name) && !relativePath.startsWith("README")) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseFrontmatter(raw, filePath) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    const date = path.basename(filePath, ".md").slice(0, 10);
    return { meta: { title: date, date, tags: [] }, content: raw.trim() };
  }

  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === "tags") {
      meta.tags = value
        .replace(/^\[/, "")
        .replace(/\]$/, "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    } else {
      meta[key] = value.replace(/^["']|["']$/g, "");
    }
  }

  return { meta, content: match[2].trim() };
}

function createExcerpt(content) {
  const line = content
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith("#") && !item.startsWith("![") && !item.startsWith("[video"));

  if (!line) return "";
  return line
    .replace(/^[-*\d.]+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .slice(0, 90);
}

function toSlug(date, filePath) {
  const name = path.basename(filePath, ".md").replace(/^\d{4}-\d{2}-\d{2}_?/, "");
  return name && name !== date ? `${date}-${name}` : date;
}

const files = await collectMarkdownFiles(rootDir);
const entries = [];

for (const file of files) {
  const raw = await readFile(file, "utf8");
  const { meta, content } = parseFrontmatter(raw, file);
  const relativePath = path.relative(rootDir, file).split(path.sep).join("/");
  const date = meta.date || path.basename(file, ".md").slice(0, 10);

  entries.push({
    title: meta.title || date,
    date,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    slug: toSlug(date, file),
    path: relativePath,
    excerpt: createExcerpt(content),
    content,
  });
}

entries.sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug));

const output = `window.JOURNAL_ENTRIES = ${JSON.stringify(entries, null, 2)};\n`;
await writeFile(outputPath, output, "utf8");

console.log(`Wrote ${entries.length} journal entries to ${path.relative(rootDir, outputPath)}`);
