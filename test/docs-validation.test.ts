/**
 * Documentation & CI validation — Stage 9 (TC-DOCS).
 *
 * Verifies REQ-DOCS-CONVERSION, REQ-DOCS-ONBOARDING, REQ-DOCS-SURFACES, and
 * REQ-CI-PARITY: the README explains RQML and the opencode plugin, links the
 * onboarding docs, describes enforcement honestly, has no broken relative links,
 * and the CI workflow runs the authoritative gate.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), "utf8");

const DOCS = ["README.md", "docs/why-rqml-opencode.md", "docs/quickstart.md", "docs/troubleshooting.md"];

// --- REQ-DOCS-CONVERSION + REQ-DOCS-SURFACES ----------------------------

test("REQ-DOCS-CONVERSION: the README explains RQML and what the plugin does", () => {
  const readme = read("README.md");
  assert.match(readme, /## What is RQML\?/);
  assert.match(readme, /## What this plugin does/);
  assert.match(readme, /requirements\.rqml/);
  assert.match(readme, /no language model is in the enforcement/i);
});

test("REQ-DOCS-SURFACES: the README describes enforcement honestly", () => {
  const readme = read("README.md");
  assert.match(readme, /Enforcement on opencode/i);
  assert.match(readme, /Hard block/);
  assert.match(readme, /Advisory/);
  assert.match(readme, /Authoritative/);
  assert.match(readme, /subagent/i);
  assert.match(readme, /5894/);
  assert.match(readme, /never block/i, "states the turn-end check does not block");
});

// --- REQ-DOCS-ONBOARDING ------------------------------------------------

test("REQ-DOCS-ONBOARDING: the README links the onboarding docs and the install path", () => {
  const readme = read("README.md");
  for (const link of ["docs/quickstart.md", "docs/why-rqml-opencode.md", "docs/troubleshooting.md"]) {
    assert.ok(readme.includes(link), `README links ${link}`);
  }
  assert.match(readme, /## Install/);
  assert.match(read("docs/quickstart.md"), /rqml check/);
});

// --- no broken relative links -------------------------------------------

test("REQ-DOCS-ONBOARDING: every relative documentation link resolves", () => {
  const linkRe = /\]\(([^)]+)\)|href="([^"]+)"/g;
  for (const doc of DOCS) {
    const dir = dirname(resolve(repoRoot, doc));
    const text = read(doc);
    for (const match of text.matchAll(linkRe)) {
      const target = (match[1] ?? match[2]).trim();
      if (/^[a-z]+:\/\//i.test(target) || target.startsWith("#") || target.startsWith("mailto:")) continue;
      const path = target.split("#")[0].split("?")[0];
      if (!path) continue;
      assert.ok(existsSync(resolve(dir, path)), `${doc}: broken relative link -> ${target}`);
    }
  }
});

// --- REQ-CI-PARITY ------------------------------------------------------

test("REQ-CI-PARITY: CI runs the test suite and the authoritative rqml gate", () => {
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /npm test/);
  assert.match(ci, /@rqml\/cli check/, "CI runs rqml check");
  assert.match(ci, /--strictness strict/, "CI runs the strict gate");
  assert.match(ci, /check:craft/, "CI runs the craft drift guard");
  assert.match(ci, /pull_request/);
});
