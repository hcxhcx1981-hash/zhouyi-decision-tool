import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const FORBIDDEN_RELEASE_STRINGS = [
  ["miaoduai", ".cn"].join(""),
  ["www", ".miaoduai", ".cn"].join(""),
  "MBTI",
  "喵毒",
  "Vercel",
  "localhost:3036",
  "localhost:3037",
];

export const FROZEN_RELEASE_FILES = [
  "data/frozen/周易问事_起卦与占变裁决协议_V0.1.md",
  "data/frozen/zhouyi_divination_rules_v0.1.json",
  "data/frozen/zhouyi_rule_test_cases_v0.1.json",
  "data/frozen/validate_zhouyi_rules_v01.py",
  "data/frozen/02_乾坤屯_结构化_V0.3.1.json",
];

const API_KEY_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\bBearer\s+[A-Za-z0-9._-]{20,}\b/i,
];

const CLOUDBASE_ENV_PATTERNS = [
  /\b(?:CLOUDBASE_ENV_ID|TCB_ENV_ID)\s*[:=]\s*["']?[a-z0-9-]{6,}/i,
  /["']envId["']\s*:\s*["'][a-z0-9-]{6,}["']/i,
];

function listFiles(root) {
  if (!fs.existsSync(root)) {
    return [];
  }

  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(absolutePath));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

function displayPath(projectRoot, filePath) {
  return path.relative(projectRoot, filePath).replaceAll(path.sep, "/");
}

export function auditRelease({
  projectRoot = process.cwd(),
  outDir = path.resolve(projectRoot, "out"),
  environment = process.env,
  frozenFiles = FROZEN_RELEASE_FILES,
} = {}) {
  const errors = [];
  const indexPath = path.join(outDir, "index.html");
  const notFoundPath = path.join(outDir, "404.html");
  const nextDir = path.join(outDir, "_next");

  if (!fs.existsSync(indexPath)) {
    errors.push("Missing required release file: out/index.html");
  }
  if (!fs.existsSync(notFoundPath)) {
    errors.push("Missing required release file: out/404.html");
  }

  const nextFiles = listFiles(nextDir);
  if (nextFiles.length === 0) {
    errors.push("Missing static resources: out/_next must contain at least one file");
  }

  for (const relativePath of frozenFiles) {
    if (!fs.existsSync(path.resolve(projectRoot, relativePath))) {
      errors.push(`Missing frozen source file: ${relativePath}`);
    }
  }

  const outputFiles = listFiles(outDir);
  for (const filePath of outputFiles) {
    const relativePath = displayPath(projectRoot, filePath);
    const content = fs.readFileSync(filePath).toString("utf8");
    const searchable = `${relativePath}\n${content}`;

    for (const forbidden of FORBIDDEN_RELEASE_STRINGS) {
      if (searchable.toLocaleLowerCase().includes(forbidden.toLocaleLowerCase())) {
        errors.push(`Forbidden release string "${forbidden}" found in ${relativePath}`);
      }
    }

    for (const pattern of API_KEY_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(`Possible API key found in ${relativePath}`);
      }
    }

    for (const pattern of CLOUDBASE_ENV_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(`Possible CloudBase environment ID found in ${relativePath}`);
      }
    }
  }

  const configuredSiteUrl = environment.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  if (configuredSiteUrl) {
    let siteUrl;
    try {
      siteUrl = new URL(configuredSiteUrl);
    } catch {
      errors.push("NEXT_PUBLIC_SITE_URL is not a valid URL");
    }

    if (siteUrl) {
      if (siteUrl.protocol !== "https:") {
        errors.push("NEXT_PUBLIC_SITE_URL must start with https://");
      } else {
        const hostFound = outputFiles.some((filePath) =>
          fs.readFileSync(filePath).toString("utf8").includes(siteUrl.hostname),
        );
        if (!hostFound) {
          errors.push(`Configured site hostname not found in release output: ${siteUrl.hostname}`);
        }
      }
    }
  } else {
    const htmlFiles = outputFiles.filter((filePath) => filePath.endsWith(".html"));
    const externalHosts = new Set();
    for (const filePath of htmlFiles) {
      const content = fs.readFileSync(filePath, "utf8");
      for (const match of content.matchAll(/https:\/\/([A-Za-z0-9.-]+)/g)) {
        externalHosts.add(match[1]);
      }
    }
    if (externalHosts.size > 0) {
      errors.push(
        `External hostname found while NEXT_PUBLIC_SITE_URL is empty: ${[...externalHosts].join(", ")}`,
      );
    }
  }

  return {
    errors: [...new Set(errors)],
    filesScanned: outputFiles.length,
    nextFiles: nextFiles.length,
  };
}

function runCli() {
  const result = auditRelease();
  if (result.errors.length > 0) {
    console.error("RELEASE AUDIT FAILED");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `RELEASE AUDIT PASS: ${result.filesScanned} output files checked; ${result.nextFiles} _next resources found.`,
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  runCli();
}
