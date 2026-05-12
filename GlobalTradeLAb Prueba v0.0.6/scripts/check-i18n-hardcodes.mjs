import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, "src");

const TARGET_EXTENSIONS = new Set([".jsx", ".tsx"]);
const IGNORED_DIRECTORIES = new Set([
  "Languages",
  "lib",
  "assets",
]);

const ATTRIBUTE_NAMES = [
  "placeholder",
  "title",
  "aria-label",
  "aria-description",
  "alt",
];

const COMMENT_IGNORE_FILE = "i18n-audit-ignore-file";
const COMMENT_IGNORE_NEXT = "i18n-audit-ignore-next-line";

const NOISE_PATTERNS = [
  /^[A-Z0-9 .:/_+-]{1,12}$/,
  /^GlobalTradeLab$/i,
  /^GlobalTrade$/i,
  /^Lab$/i,
  /^[A-Z]$/,
  /^[A-Z]{2,6}$/,
  /^[A-Z]{1,6}USD$/,
  /^\d+[smhd]$/,
];

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      files.push(...walk(fullPath));
      continue;
    }

    if (TARGET_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function shouldIgnoreValue(value) {
  const normalized = value
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return true;
  }

  if (normalized.includes("{") || normalized.includes("}")) {
    return true;
  }

  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(normalized)) {
    return true;
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return true;
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return true;
  }

  return NOISE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function collectFindings(filePath) {
  const relativePath = path.relative(projectRoot, filePath);
  const content = fs.readFileSync(filePath, "utf8");

  if (content.includes(COMMENT_IGNORE_FILE)) {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const findings = [];
  let ignoreNextLine = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;

    if (ignoreNextLine) {
      ignoreNextLine = false;
      continue;
    }

    if (line.includes(COMMENT_IGNORE_NEXT)) {
      ignoreNextLine = true;
      continue;
    }

    if (/^\s*(import|export)\b/.test(line)) {
      continue;
    }

    if (/<\/?[A-Za-z]/.test(line)) {
      const jsxTextRegex = />\s*([^<{][^<{]*[A-Za-zÁÉÍÓÚáéíóúÑñ][^<{]*)\s*</g;
      for (const match of line.matchAll(jsxTextRegex)) {
        const value = match[1]?.trim();
        if (!shouldIgnoreValue(value)) {
          findings.push({
            file: relativePath,
            line: lineNumber,
            kind: "jsx-text",
            value,
          });
        }
      }
    }

    for (const attributeName of ATTRIBUTE_NAMES) {
      const attributeRegex = new RegExp(`${attributeName}\\s*=\\s*"([^"]*[A-Za-zÁÉÍÓÚáéíóúÑñ][^"]*)"`, "g");
      for (const match of line.matchAll(attributeRegex)) {
        const value = match[1]?.trim();
        if (!shouldIgnoreValue(value)) {
          findings.push({
            file: relativePath,
            line: lineNumber,
            kind: "attribute",
            value: `${attributeName}="${value}"`,
          });
        }
      }
    }
  }

  return findings;
}

function main() {
  const files = walk(srcRoot);
  const findings = files.flatMap(collectFindings);

  if (findings.length === 0) {
    console.log("i18n audit passed: no obvious hardcoded UI strings were found.");
    return;
  }

  console.error("i18n audit failed: possible hardcoded UI strings found.\n");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.kind}] ${finding.value}`);
  }

  console.error("\nHints:");
  console.error(`- Move UI copy into src/Languages/es.js and src/Languages/en.js.`);
  console.error(`- Use ${COMMENT_IGNORE_NEXT} on the line before an intentional exception.`);
  console.error(`- Use ${COMMENT_IGNORE_FILE} only for files that should stay outside i18n on purpose.`);

  process.exitCode = 1;
}

main();
