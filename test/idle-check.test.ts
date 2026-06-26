/**
 * Advisory idle-check + workspace fan-out tests — Stage 5 (ADR-0002).
 *
 * Verifies REQ-TURN-END-CHECK, REQ-HOOK-WORKSPACE, REQ-ENFORCEMENT-HONESTY
 * (TC-IDLE-ADVISORY, TC-IDLE-QUIET, TC-WORKSPACE).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { createIdleCheck } from "../src/hooks/idle-check.ts";
import { createAnchor } from "../src/hooks/anchor.ts";
import { MINIMAL_SPEC, tmpProject, cleanup, fakeShell, realShell, makeContext, rqmlAvailable } from "./_helpers.ts";

const idle = (sessionID = "s") => ({ event: { type: "session.idle", properties: { sessionID } } });

const WS_STATUS_2 = [
  "RQML status — WS-A (2.1.0, draft)",
  "  requirements: 1",
  "RQML status — WS-B (2.1.0, draft)",
  "  requirements: 1",
  "✓ workspace status: 2 spec(s)",
].join("\n");

const WS_CHECK_FAIL = [
  "✗ check fail (standard) — /ws/pkg-a/requirements.rqml",
  "✓ workspace check: 2 spec(s)",
].join("\n");

// --- REQ-TURN-END-CHECK -------------------------------------------------

test("TC-IDLE-ADVISORY: a failing check surfaces a toast + soft prompt, never blocks, names CI", async () => {
  const root = tmpProject();
  try {
    writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
    const { ctx, toasts, prompts } = makeContext({ $: fakeShell({ exitCode: 2, stdout: "drifted: src/x.ts changed" }), directory: root });
    await createIdleCheck(ctx)(idle() as never); // must resolve (never throws/blocks)
    assert.equal(toasts.length, 1, "one advisory toast");
    assert.match(toasts[0].message, /\bCI\b/, "toast names CI");
    assert.match(toasts[0].message, /advisory/i);
    assert.equal(prompts.length, 1, "one interactive soft continuation");
    assert.match(prompts[0].body.parts[0].text, /drifted: src\/x\.ts/, "soft prompt carries the verbatim diagnostics");
  } finally {
    cleanup(root);
  }
});

test("TC-IDLE-QUIET: a passing check surfaces nothing", async () => {
  const root = tmpProject();
  try {
    writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
    const { ctx, toasts, prompts, notes } = makeContext({ $: fakeShell({ exitCode: 0, stdout: "check pass" }), directory: root });
    await createIdleCheck(ctx)(idle() as never);
    assert.equal(toasts.length, 0);
    assert.equal(prompts.length, 0);
    assert.equal(notes.length, 0);
  } finally {
    cleanup(root);
  }
});

test("idle check is idempotent: an unchanged verdict is surfaced once", async () => {
  const root = tmpProject();
  try {
    writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
    const { ctx, toasts } = makeContext({ $: fakeShell({ exitCode: 2, stdout: "same finding" }), directory: root });
    const hook = createIdleCheck(ctx);
    await hook(idle() as never);
    await hook(idle() as never);
    assert.equal(toasts.length, 1, "the same verdict is not re-surfaced");
  } finally {
    cleanup(root);
  }
});

test("idle check fails open and warns once when the CLI is missing", async () => {
  const root = tmpProject();
  try {
    writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
    const { ctx, toasts, notes } = makeContext({ $: fakeShell({ reject: "ENOENT" }), directory: root });
    await createIdleCheck(ctx)(idle() as never);
    assert.equal(toasts.length, 0);
    assert.equal(notes.length, 1);
    assert.match(notes[0], /@rqml\/cli/);
  } finally {
    cleanup(root);
  }
});

test("headless (no live toast): the banner is logged and no soft prompt is issued", async () => {
  const root = tmpProject();
  try {
    writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
    const { ctx, toasts, prompts, notes } = makeContext({ $: fakeShell({ exitCode: 2, stdout: "headless finding" }), directory: root, toastShown: false });
    await createIdleCheck(ctx)(idle() as never);
    assert.equal(toasts.length, 1, "a toast is attempted");
    assert.equal(prompts.length, 0, "no soft prompt without a live surface");
    assert.ok(notes.some((n) => /headless finding/.test(n)), "banner logged for headless visibility");
  } finally {
    cleanup(root);
  }
});

test("idle check ignores non-idle events", async () => {
  const root = tmpProject();
  try {
    writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
    const { ctx, toasts } = makeContext({ $: fakeShell({ exitCode: 2, stdout: "x" }), directory: root });
    await createIdleCheck(ctx)({ event: { type: "file.edited", properties: {} } } as never);
    assert.equal(toasts.length, 0);
  } finally {
    cleanup(root);
  }
});

// --- REQ-HOOK-WORKSPACE -------------------------------------------------

test("TC-WORKSPACE: the anchor lists the units at a spec-less workspace root", async () => {
  const root = tmpProject(); // no spec of its own
  try {
    const { ctx } = makeContext({ $: fakeShell({ exitCode: 0, stdout: WS_STATUS_2 }), directory: root });
    const { systemTransform } = createAnchor(ctx);
    const output = { system: [] as string[] };
    await systemTransform({ sessionID: "s", model: { providerID: "p", modelID: "m" } } as never, output as never);
    assert.equal(output.system.length, 1);
    assert.match(output.system[0], /workspace root governing 2 package spec/);
    assert.match(output.system[0], /rqml check --workspace/);
  } finally {
    cleanup(root);
  }
});

test("TC-WORKSPACE: idle surfaces aggregated workspace diagnostics when a unit fails", async () => {
  const root = tmpProject(); // no spec of its own
  try {
    const { ctx, toasts, prompts } = makeContext({ $: fakeShell({ exitCode: 2, stdout: WS_CHECK_FAIL }), directory: root });
    await createIdleCheck(ctx)(idle() as never);
    assert.equal(toasts.length, 1);
    assert.match(prompts[0].body.parts[0].text, /workspace check/);
  } finally {
    cleanup(root);
  }
});

test("a truly ungoverned directory (0 specs) stays silent", async () => {
  const root = tmpProject();
  try {
    const { ctx, toasts, notes } = makeContext({ $: fakeShell({ exitCode: 0, stdout: "✓ workspace check: 0 spec(s)" }), directory: root });
    await createIdleCheck(ctx)(idle() as never);
    assert.equal(toasts.length, 0);
    assert.equal(notes.length, 0);
  } finally {
    cleanup(root);
  }
});

// --- real-CLI integration ----------------------------------------------

test(
  "TC-IDLE-ADVISORY (integration): a real strict-mode coverage failure surfaces advisorily",
  { skip: rqmlAvailable() ? false : "rqml CLI not on PATH" },
  async () => {
    const root = tmpProject();
    try {
      writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
      writeFileSync(join(root, "AGENTS.md"), "## Strictness: `strict`\n"); // force a coverage failure
      const { ctx, toasts, prompts } = makeContext({ $: realShell(), directory: root });
      await createIdleCheck(ctx)(idle() as never);
      assert.equal(toasts.length, 1, "real strict check fails on the unimplemented requirement");
      assert.match(prompts[0].body.parts[0].text, /unimplemented|coverage|REQ-X/i);
    } finally {
      cleanup(root);
    }
  },
);
