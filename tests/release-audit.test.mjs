import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { auditRelease } from "../scripts/audit-release.mjs";

function createReleaseFixture(indexContent = "<html><body>ok</body></html>") {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zhouyi-release-audit-"));
  const outDir = path.join(projectRoot, "out");
  fs.mkdirSync(path.join(outDir, "_next"), { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), indexContent);
  fs.writeFileSync(path.join(outDir, "404.html"), "<html><body>404</body></html>");
  fs.writeFileSync(path.join(outDir, "_next", "app.js"), "console.log('ok')");
  return { projectRoot, outDir };
}

test("release:audit 能发现禁止字符串", (context) => {
  const forbiddenDomain = ["miaoduai", ".cn"].join("");
  const fixture = createReleaseFixture(`<html><body>${forbiddenDomain}</body></html>`);
  context.after(() => fs.rmSync(fixture.projectRoot, { recursive: true, force: true }));

  const result = auditRelease({ ...fixture, environment: {}, frozenFiles: [] });
  assert.equal(result.errors.some((error) => error.includes(forbiddenDomain)), true);
});

test("release:audit 能识别缺失 out/index.html", (context) => {
  const fixture = createReleaseFixture();
  fs.rmSync(path.join(fixture.outDir, "index.html"));
  context.after(() => fs.rmSync(fixture.projectRoot, { recursive: true, force: true }));

  const result = auditRelease({ ...fixture, environment: {}, frozenFiles: [] });
  assert.equal(result.errors.some((error) => error.includes("out/index.html")), true);
});
