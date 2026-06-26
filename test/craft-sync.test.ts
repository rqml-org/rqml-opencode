/**
 * Vendored-craft tests — Stage 7.
 *
 * Verifies REQ-SKILL-AUTHORING and REQ-CRAFT-GUARD (CRIT-CRAFT-GUARD). The
 * deterministic checks run with no network; the live comparison against the
 * canonical rqml-skill source is the standalone scripts/check-craft-drift.ts
 * guard (PR-only in CI).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CRAFT_FILES, checkDrift } from "../src/content/craft.ts";

test("CRIT-CRAFT-GUARD: checkDrift flags divergence, passes on match, skips when unreachable", () => {
  assert.equal(checkDrift("same bytes", "same bytes"), "ok");
  assert.equal(checkDrift("a local edit", "the canonical"), "drifted");
  assert.equal(checkDrift("anything", null), "skipped", "an unreachable source is skipped, not failed");
});

test("REQ-SKILL-AUTHORING: two craft files are vendored, each stamped and naming its source", () => {
  assert.equal(CRAFT_FILES.length, 2);
  for (const path of CRAFT_FILES) {
    const text = readFileSync(path, "utf8");
    assert.match(text, /canonical-version:\s*\d+/i, `${path} carries a canonical-version stamp`);
    assert.match(text, /rqml-skill/i, `${path} names its canonical source`);
    assert.ok(text.trim().length > 200, `${path} has real content`);
  }
});
