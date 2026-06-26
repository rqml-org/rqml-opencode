/**
 * Spec-edit validation tests — Stage 3.
 *
 * Verifies REQ-HOOK-SPEC-VALIDATE and REQ-HOOK-DIAGNOSTICS (TC-SPEC-EDIT).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { specEditValidate } from "../src/hooks/spec-validate.ts";
import { tmpProject, cleanup, fakeShell, realShell, makeContext, rqmlAvailable } from "./_helpers.ts";

const after = (tool: string, filePath: string) => ({ tool, sessionID: "s", callID: "c", args: { filePath } });

test("TC-SPEC-EDIT: appends the validation diagnostic to the tool output when invalid", async () => {
  const { ctx } = makeContext({ $: fakeShell({ exitCode: 1, stdout: "error:2007 duplicate id 'REQ-X'" }), directory: process.cwd() });
  const out: { title: string; output: string; metadata: unknown } = { title: "t", output: "Wrote requirements.rqml", metadata: {} };
  await specEditValidate(ctx)(after("write", "requirements.rqml") as never, out as never);
  assert.match(out.output, /duplicate id/);
  assert.match(out.output, /rqml validate/);
  assert.match(out.output, /Wrote requirements\.rqml/, "the original tool output is preserved");
});

test("spec-validate leaves the output untouched when the document is valid", async () => {
  const { ctx } = makeContext({ $: fakeShell({ exitCode: 0, stdout: "valid" }), directory: process.cwd() });
  const out = { title: "t", output: "ok", metadata: {} };
  await specEditValidate(ctx)(after("edit", "requirements.rqml") as never, out as never);
  assert.equal(out.output, "ok");
});

test("spec-validate ignores non-.rqml edits and never warns for them", async () => {
  const { ctx, notes } = makeContext({ $: fakeShell({ exitCode: 1, stdout: "x" }), directory: process.cwd() });
  const out = { title: "t", output: "ok", metadata: {} };
  await specEditValidate(ctx)(after("edit", "src/index.ts") as never, out as never);
  assert.equal(out.output, "ok");
  assert.equal(notes.length, 0);
});

test("spec-validate fails open and warns once when the CLI is missing", async () => {
  const { ctx, notes } = makeContext({ $: fakeShell({ reject: "ENOENT" }), directory: process.cwd() });
  const out = { title: "t", output: "ok", metadata: {} };
  await specEditValidate(ctx)(after("write", "requirements.rqml") as never, out as never);
  assert.equal(out.output, "ok", "output is untouched when the CLI is unavailable");
  assert.equal(notes.length, 1);
});

test(
  "TC-SPEC-EDIT (integration): a real duplicate-id document surfaces the duplicate-id diagnostic",
  { skip: rqmlAvailable() ? false : "rqml CLI not on PATH" },
  async () => {
    const root = tmpProject();
    try {
      const dup = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="DUP-001" status="draft">
  <meta><title>Dup</title><system>dup</system></meta>
  <requirements>
    <req id="REQ-X" type="FR" title="A" priority="must" status="draft"><statement>The system SHALL A.</statement></req>
    <req id="REQ-X" type="FR" title="B" priority="must" status="draft"><statement>The system SHALL B.</statement></req>
  </requirements>
</rqml>
`;
      writeFileSync(join(root, "requirements.rqml"), dup);
      const { ctx } = makeContext({ $: realShell(), directory: root });
      const out: { title: string; output: string; metadata: unknown } = { title: "t", output: "Wrote requirements.rqml", metadata: {} };
      await specEditValidate(ctx)(after("write", "requirements.rqml") as never, out as never);
      assert.match(out.output, /REQ-X|duplicate/i);
    } finally {
      cleanup(root);
    }
  },
);
