/**
 * Command-surface tests — Stage 6 (ADR-0004).
 *
 * Verifies REQ-COMMAND-SURFACES, REQ-CMD-INIT/STATUS/CHECK/DESIGN/PLAN/REVIEW,
 * and REQ-PATH-DISCIPLINE. The surfaces are workflow prompts, so the tests check
 * that they are well-formed and instruct the right CLI-driven workflow; the
 * end behavior (e.g. writing an ADR) is the agent's, exercised by the templates.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { COMMANDS, toConfigCommands, toPluginTools } from "../src/commands/index.ts";
import { tmpProject, cleanup, rqmlAvailable } from "./_helpers.ts";

function bySlash(slash: string) {
  const cmd = COMMANDS.find((c) => c.slash === slash);
  assert.ok(cmd, `surface ${slash} exists`);
  return cmd;
}

// --- REQ-COMMAND-SURFACES ------------------------------------------------

test("REQ-COMMAND-SURFACES: all six surfaces exist with unique ids and non-empty content", () => {
  assert.equal(COMMANDS.length, 6);
  const slashes = COMMANDS.map((c) => c.slash);
  const keys = COMMANDS.map((c) => c.key);
  assert.deepEqual([...new Set(slashes)].length, 6, "unique slash names");
  assert.deepEqual([...new Set(keys)].length, 6, "unique keys");
  for (const cmd of COMMANDS) {
    assert.ok(cmd.template.trim().length > 0, `${cmd.slash} has a template`);
    assert.ok(cmd.description.trim().length > 0, `${cmd.slash} has a description`);
  }
  assert.deepEqual(slashes.sort(), ["rqml-check", "rqml-design", "rqml-init", "rqml-plan", "rqml-review", "rqml-status"]);
});

test("REQ-COMMAND-SURFACES: config commands are keyed by slash with template + description", () => {
  const config = toConfigCommands();
  assert.equal(Object.keys(config).length, 6);
  for (const cmd of COMMANDS) {
    assert.equal(config[cmd.slash].template, cmd.template);
    assert.equal(config[cmd.slash].description, cmd.description);
  }
});

test("REQ-COMMAND-SURFACES: plugin tools use the rqml_wf_ prefix (no collision with @rqml/mcp tools)", async () => {
  const tools = toPluginTools();
  const ids = Object.keys(tools);
  assert.equal(ids.length, 6);
  assert.ok(ids.every((id) => id.startsWith("rqml_wf_")), "all tool ids are namespaced");
  assert.ok(!ids.includes("rqml_check") && !ids.includes("rqml_status"), "no collision with MCP atomic tools");
  const out = await tools.rqml_wf_check.execute({}, {} as never);
  assert.match(String(out), /rqml check/, "the tool returns its workflow guidance");
});

// --- per-surface content (REQ-CMD-*) ------------------------------------

test("REQ-CMD-INIT: init scaffolds, elicits, and arms enforcement", () => {
  const t = bySlash("rqml-init").template;
  assert.match(t, /rqml init/);
  assert.match(t, /elicit|interview/i);
  assert.match(t, /opencode\.json|\.opencode\/plugins/);
});

test("REQ-CMD-STATUS: status re-anchors and states the honest posture", () => {
  const t = bySlash("rqml-status").template;
  assert.match(t, /rqml status/);
  assert.match(t, /ADVISORY/);
  assert.match(t, /\bCI\b/);
  assert.match(t, /subagent/i);
});

test("REQ-CMD-CHECK: check runs the gate and resolves via the loop", () => {
  const t = bySlash("rqml-check").template;
  assert.match(t, /rqml check/);
  assert.match(t, /rqml show/);
  assert.match(t, /rqml link/);
});

test("REQ-CMD-DESIGN: design writes an ADR in .rqml/adr/ in the canonical format", () => {
  const t = bySlash("rqml-design").template;
  assert.match(t, /\.rqml\/adr\//);
  assert.match(t, /Supersession/);
  assert.match(t, /immutable/);
});

test("REQ-CMD-PLAN: plan writes a staged .rqml/plan.md", () => {
  const t = bySlash("rqml-plan").template;
  assert.match(t, /\.rqml\/plan\.md/);
  assert.match(t, /stage/i);
});

test("REQ-CMD-REVIEW: review renders the matrix and approves via the toolchain", () => {
  const t = bySlash("rqml-review").template;
  assert.match(t, /rqml matrix/);
  assert.match(t, /rqml approve/);
});

// --- REQ-PATH-DISCIPLINE -------------------------------------------------

test("REQ-PATH-DISCIPLINE: trace/status edits go through the CLI, never hand-edited XML", () => {
  assert.match(bySlash("rqml-check").template, /rqml link/);
  assert.match(bySlash("rqml-review").template, /do not hand-edit/i);
  // No surface tells the agent to write trace <edge> XML by hand.
  for (const cmd of COMMANDS) assert.doesNotMatch(cmd.template, /<edge\b/);
});

// --- real-CLI integration: the verbs the templates rely on exist ---------

test(
  "CRIT-REVIEW-ACCEPT (integration): `rqml approve` transitions a draft requirement to approved",
  { skip: rqmlAvailable() ? false : "rqml CLI not on PATH" },
  () => {
    const root = tmpProject();
    try {
      const spec = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="REV-001" status="draft">
  <meta><title>Review</title><system>review</system></meta>
  <requirements>
    <req id="REQ-X" type="FR" title="X" priority="must" status="draft"><statement>The system SHALL X.</statement></req>
  </requirements>
</rqml>
`;
      writeFileSync(join(root, "requirements.rqml"), spec);
      const r = spawnSync("rqml", ["approve", "REQ-X"], { cwd: root, encoding: "utf8" });
      assert.equal(r.status, 0, "rqml approve exits cleanly");
      assert.match(readFileSync(join(root, "requirements.rqml"), "utf8"), /id="REQ-X"[^>]*status="approved"|status="approved"[^>]*id="REQ-X"/);
    } finally {
      cleanup(root);
    }
  },
);
