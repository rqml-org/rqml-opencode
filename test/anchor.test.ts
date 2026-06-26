/**
 * Session-anchor tests — Stage 4 (ADR-0002, ADR-0003).
 *
 * Verifies REQ-HOOK-ANCHOR, REQ-ENFORCEMENT-HONESTY, REQ-EXPERIMENTAL-API-RISK
 * (TC-ANCHOR, TC-API-ABSENT).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildAnchor, ENFORCEMENT_POSTURE } from "../src/content/anchor.ts";
import { createAnchor } from "../src/hooks/anchor.ts";
import { MINIMAL_SPEC, tmpProject, cleanup, fakeShell, realShell, makeContext, rqmlAvailable } from "./_helpers.ts";

const SAMPLE_STATUS = [
  "RQML status — RQML-OPENCODE-001 (2.1.0, draft)",
  "  requirements: 36   trace edges: 128",
  "  unimplemented reqs: 23 (approved: 23)",
].join("\n");

const sys = (sessionID = "s") => [{ sessionID, model: { providerID: "p", modelID: "m" } }, { system: [] as string[] }] as const;

// --- buildAnchor content (TC-ANCHOR) ------------------------------------

test("TC-ANCHOR: the anchor carries the docId, coverage, the loop, and the advisory note", () => {
  const anchor = buildAnchor(SAMPLE_STATUS);
  assert.match(anchor, /RQML-OPENCODE-001/, "docId");
  assert.match(anchor, /requirements: 36/, "coverage summary");
  assert.match(anchor, /Loop: Spec/, "five-stage loop reminder");
  assert.match(anchor, /ADVISORY/, "advisory turn-end note");
  assert.match(anchor, /\bCI\b/, "names CI as authoritative");
  assert.match(ENFORCEMENT_POSTURE, /hard-blocked at the tool boundary/, "names the hard pre-edit gate");
});

// --- experimental.chat.system.transform (preferred channel) -------------

test("TC-ANCHOR: system.transform pushes the anchor onto the system prompt", async () => {
  const root = tmpProject();
  try {
    writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
    const { ctx } = makeContext({ $: fakeShell({ exitCode: 0, stdout: SAMPLE_STATUS }), directory: root });
    const { systemTransform } = createAnchor(ctx);
    const [input, output] = sys();
    await systemTransform(input as never, output as never);
    assert.equal(output.system.length, 1);
    assert.match(output.system[0], /RQML-OPENCODE-001/);
    assert.match(output.system[0], /ADVISORY/);
  } finally {
    cleanup(root);
  }
});

test("system.transform stays silent when the project is ungoverned (dormant)", async () => {
  const root = tmpProject(); // .git boundary, no spec
  try {
    const { ctx } = makeContext({ $: fakeShell({ exitCode: 0, stdout: SAMPLE_STATUS }), directory: root });
    const { systemTransform } = createAnchor(ctx);
    const [input, output] = sys();
    await systemTransform(input as never, output as never);
    assert.equal(output.system.length, 0);
  } finally {
    cleanup(root);
  }
});

// --- TC-API-ABSENT: chat.message fallback + guard -----------------------

test("TC-API-ABSENT: chat.message delivers the anchor when system.transform never runs", async () => {
  const root = tmpProject();
  try {
    writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
    const { ctx } = makeContext({ $: fakeShell({ exitCode: 0, stdout: SAMPLE_STATUS }), directory: root });
    const { chatMessage } = createAnchor(ctx);
    const out = { message: {}, parts: [{ type: "text", text: "do the thing" }] };
    await chatMessage({ sessionID: "s" } as never, out as never);
    assert.match(out.parts[0].text, /RQML-OPENCODE-001/, "anchor prepended");
    assert.match(out.parts[0].text, /do the thing/, "original message preserved");
  } finally {
    cleanup(root);
  }
});

test("chat.message defers once system.transform has run (no double injection)", async () => {
  const root = tmpProject();
  try {
    writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
    const { ctx } = makeContext({ $: fakeShell({ exitCode: 0, stdout: SAMPLE_STATUS }), directory: root });
    const anchor = createAnchor(ctx);
    const [input, output] = sys();
    await anchor.systemTransform(input as never, output as never); // marks host support
    const out = { message: {}, parts: [{ type: "text", text: "hello" }] };
    await anchor.chatMessage({ sessionID: "s" } as never, out as never);
    assert.equal(out.parts[0].text, "hello", "chat.message must not inject once system.transform is active");
  } finally {
    cleanup(root);
  }
});

test("TC-API-ABSENT: a malformed system output is contained, not thrown (REQ-EXPERIMENTAL-API-RISK)", async () => {
  const root = tmpProject();
  try {
    writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
    const { ctx, notes } = makeContext({ $: fakeShell({ exitCode: 0, stdout: SAMPLE_STATUS }), directory: root });
    const { systemTransform } = createAnchor(ctx);
    // output.system is missing -> pushing throws inside the body; the guard must swallow it.
    await systemTransform({ sessionID: "s" } as never, {} as never);
    assert.ok(notes.some((n) => /unavailable on this opencode build/.test(n)), "degraded notice surfaced once");
  } finally {
    cleanup(root);
  }
});

// --- real-CLI integration ----------------------------------------------

test(
  "TC-ANCHOR (integration): system.transform injects a real `rqml status` anchor",
  { skip: rqmlAvailable() ? false : "rqml CLI not on PATH" },
  async () => {
    const root = tmpProject();
    try {
      writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
      const { ctx } = makeContext({ $: realShell(), directory: root });
      const { systemTransform } = createAnchor(ctx);
      const [input, output] = sys();
      await systemTransform(input as never, output as never);
      assert.equal(output.system.length, 1);
      assert.match(output.system[0], /FIX-001/, "real docId from rqml status");
      assert.match(output.system[0], /ADVISORY/);
    } finally {
      cleanup(root);
    }
  },
);
