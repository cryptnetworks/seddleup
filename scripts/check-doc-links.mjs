import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryName = "cryptnetworks/seddleup";
const markdownRoots = [".github", "docs"];

async function pathExists(candidate) {
  try {
    return await stat(candidate);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function markdownFilesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFilesUnder(entryPath)));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(entryPath);
  }

  return files;
}

export function githubSlug(value) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "-");
}

export function markdownAnchors(markdown) {
  const anchors = new Set();
  const duplicateCounts = new Map();
  let fence = null;

  for (const line of markdown.split(/\r?\n/)) {
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fence === fenceMatch[1][0]) fence = null;
      continue;
    }
    if (fence) continue;

    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$/);
    if (heading) {
      const base = githubSlug(heading[1]);
      if (base) {
        const duplicateCount = duplicateCounts.get(base) ?? 0;
        anchors.add(duplicateCount === 0 ? base : `${base}-${duplicateCount}`);
        duplicateCounts.set(base, duplicateCount + 1);
      }
    }

    for (const match of line.matchAll(
      /<(?:a\s+[^>]*?(?:id|name)|[^>]+\s+id)=["']([^"']+)["'][^>]*>/gi
    )) {
      anchors.add(match[1]);
    }
  }

  return anchors;
}

function normalizeReferenceLabel(value) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function destinationWithoutTitle(value) {
  const destination = value.trim();
  if (destination.startsWith("<")) {
    const end = destination.indexOf(">");
    return end === -1 ? destination : destination.slice(1, end);
  }
  return destination.split(/\s+["'(]/, 1)[0];
}

export function markdownDestinations(markdown) {
  const destinations = [];
  const referenceDefinitions = new Map();
  let fence = null;

  markdown.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fence === fenceMatch[1][0]) fence = null;
      return;
    }
    if (fence) return;

    const withoutInlineCode = line.replace(/`[^`]*`/g, "");
    const definition = withoutInlineCode.match(/^\s{0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)(?:\s+.*)?$/);
    if (definition) {
      const label = normalizeReferenceLabel(definition[1]);
      if (referenceDefinitions.has(label)) {
        destinations.push({
          destination: null,
          line: lineNumber,
          error: `duplicate reference definition [${definition[1]}]`
        });
      } else {
        referenceDefinitions.set(label, lineNumber);
        destinations.push({
          destination: destinationWithoutTitle(definition[2]),
          line: lineNumber
        });
      }
    }

    for (const match of withoutInlineCode.matchAll(/!?\[[^\]]*\]\(([^)\n]*)\)/g)) {
      const destination = destinationWithoutTitle(match[1]);
      destinations.push({
        destination,
        line: lineNumber,
        error: destination ? null : "empty link destination"
      });
    }

    for (const match of withoutInlineCode.matchAll(/\b(?:href|src)=["']([^"']*)["']/gi)) {
      destinations.push({
        destination: match[1],
        line: lineNumber,
        error: match[1] ? null : "empty HTML link destination"
      });
    }
  });

  return destinations;
}

function repositoryDestination(destination) {
  let parsed;
  try {
    parsed = new URL(destination);
  } catch {
    return null;
  }

  if (parsed.hostname === "github.com") {
    const prefix = `/${repositoryName}/`;
    if (!parsed.pathname.startsWith(prefix)) return null;
    const remainder = parsed.pathname.slice(prefix.length);
    if (remainder.startsWith("blob/main/")) {
      return `${remainder.slice("blob/main/".length)}${parsed.hash}`;
    }
    if (remainder.startsWith("tree/main/")) {
      return `${remainder.slice("tree/main/".length)}${parsed.hash}`;
    }
    if (remainder.startsWith("wiki/")) {
      return `docs/wiki/${remainder.slice("wiki/".length)}.md${parsed.hash}`;
    }
    return null;
  }

  if (
    parsed.hostname === "raw.githubusercontent.com" &&
    parsed.pathname.startsWith(`/${repositoryName}/main/`)
  ) {
    return parsed.pathname.slice(`/${repositoryName}/main/`.length);
  }

  return null;
}

function isExternalOrApplicationPath(destination) {
  return (
    destination.startsWith("/") || /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(destination)
  );
}

async function resolveLocalTarget(rootDirectory, sourceFile, destination) {
  const repositoryLink = repositoryDestination(destination);
  let localDestination = repositoryLink ?? destination;

  if (!repositoryLink && isExternalOrApplicationPath(localDestination)) return null;

  const hashIndex = localDestination.indexOf("#");
  const rawPath = hashIndex === -1 ? localDestination : localDestination.slice(0, hashIndex);
  const rawAnchor = hashIndex === -1 ? "" : localDestination.slice(hashIndex + 1);
  const decodedPath = decodeURIComponent(rawPath.split("?", 1)[0]);
  const anchor = decodeURIComponent(rawAnchor);

  let targetPath = decodedPath
    ? path.resolve(path.dirname(sourceFile), decodedPath)
    : path.resolve(sourceFile);
  if (repositoryLink) targetPath = path.resolve(rootDirectory, decodedPath);

  let targetStat = await pathExists(targetPath);
  if (!targetStat && path.extname(targetPath) === "") {
    targetPath = `${targetPath}.md`;
    targetStat = await pathExists(targetPath);
  }
  if (targetStat?.isDirectory()) {
    targetPath = path.join(targetPath, "README.md");
    targetStat = await pathExists(targetPath);
  }

  return { targetPath, targetStat, anchor };
}

export async function checkDocumentation(rootDirectory = process.cwd()) {
  const topLevel = (await readdir(rootDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(rootDirectory, entry.name));
  const nested = [];
  for (const relativeRoot of markdownRoots) {
    const absoluteRoot = path.join(rootDirectory, relativeRoot);
    if (await pathExists(absoluteRoot)) nested.push(...(await markdownFilesUnder(absoluteRoot)));
  }

  const files = [...topLevel, ...nested].sort();
  const contents = new Map();
  const anchors = new Map();
  const errors = [];

  for (const file of files) {
    const markdown = await readFile(file, "utf8");
    contents.set(file, markdown);
    anchors.set(file, markdownAnchors(markdown));
  }

  for (const file of files) {
    for (const link of markdownDestinations(contents.get(file))) {
      const relativeSource = path.relative(rootDirectory, file);
      if (link.error) {
        errors.push(`${relativeSource}:${link.line}: ${link.error}`);
        continue;
      }
      if (!link.destination) continue;

      let resolved;
      try {
        resolved = await resolveLocalTarget(rootDirectory, file, link.destination);
      } catch {
        errors.push(`${relativeSource}:${link.line}: malformed link ${link.destination}`);
        continue;
      }
      if (!resolved) continue;

      const relativeTarget = path.relative(rootDirectory, resolved.targetPath);
      if (!resolved.targetStat?.isFile()) {
        errors.push(
          `${relativeSource}:${link.line}: missing internal target ${link.destination} (${relativeTarget})`
        );
        continue;
      }

      if (resolved.anchor && resolved.targetPath.endsWith(".md")) {
        let targetAnchors = anchors.get(resolved.targetPath);
        if (!targetAnchors) {
          const markdown = await readFile(resolved.targetPath, "utf8");
          targetAnchors = markdownAnchors(markdown);
          anchors.set(resolved.targetPath, targetAnchors);
        }
        if (!targetAnchors.has(resolved.anchor)) {
          errors.push(
            `${relativeSource}:${link.line}: missing heading #${resolved.anchor} in ${relativeTarget}`
          );
        }
      }
    }
  }

  return { files, errors };
}

async function main() {
  const rootDirectory = fileURLToPath(new URL("..", import.meta.url));
  const result = await checkDocumentation(rootDirectory);
  if (result.errors.length > 0) {
    console.error(result.errors.join("\n"));
    console.error(`Documentation link validation failed with ${result.errors.length} error(s).`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Validated internal links and heading anchors in ${result.files.length} Markdown files.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
