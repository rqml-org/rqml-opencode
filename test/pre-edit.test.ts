/**
 * Pre-edit gate tests — Stage 3 (ADR-0001).
 *
 * Verifies REQ-HOOK-PREIMPL and REQ-PREIMPL-COVERAGE-DISCLOSURE
 * (TC-PREIMPL-DENY, TC-PREIMPL-FAILOPEN, TC-SUBAGENT-GAP).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { preEditGate } from "../src/hooks/pre-edit.ts";
import { SUBAGENT_COVERAGE_DISCLOSURE } from "../src/content/messages.ts";
import { MINIMAL_SPEC, tmpProject, cleanup, fakeShell, realShell, makeContext, rqmlAvailable } from "./_helpers.ts";

// A spec with a draft (non-approved) requirement implemented by foo.ts.
const GATE_SPEC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="GATE-001" status="draft">
  <meta><title>Gate fixture</title><system>gate</system></meta>
  <requirements>
    <req id="REQ-DRAFT" type="FR" title="Drafted" priority="must" status="draft"><statement>The system SHALL do a drafted thing.</statement></req>
  </requirements>
  <trace>
    <edge id="E-IMPL-FOO" type="implements">
      <from><locator><external uri="foo.ts" kind="code"/></locator></from>
      <to><locator><local id="REQ-DRAFT"/></locator></to>
    </edge>
  </trace>
</rqml>
`;

const before = (filePath: string) => [{ tool: "edit", sessionID: "s", callID: "c" }, { args: { filePath } }] as const;

test("TC-PREIMPL-DENY: throws when the approval gate blocks the edit (exit 2)", async () => {
  const root = tmpProject();
  try {
    writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
    mkdirSync(join(root, "src"), { recursive: true });
    const { ctx } = makeContext({ $: fakeShell({ exitCode: 2, stdout: "REQ-DRAFT is not approved" }), directory: root });
    const [i, o] = before("src/foo.ts");
    await assert.rejects(() => preEditGate(ctx)(i as never, o as never), /not approved|REQ-DRAFT/);
  } finally {
    cleanup(root);
  }
});

test("pre-edit gate allows the edit when the gate passes (exit 0)", async () => {
  const root = tmpProject();
  try {
    writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
    const { ctx } = makeContext({ $: fakeShell({ exitCode: 0 }), directory: root });
    const [i, o] = before("src/foo.ts");
    await preEditGate(ctx)(i as never, o as never); // must not throw
  } finally {
    cleanup(root);
  }
});

test("TC-PREIMPL-FAILOPEN: a missing CLI does not throw and warns exactly once", async () => {
  const root = tmpProject();
  try {
    writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
    const { ctx, notes } = makeContext({ $: fakeShell({ reject: "spawn rqml ENOENT" }), directory: root });
    const gate = preEditGate(ctx);
    await gate(...(before("src/foo.ts") as unknown as [never, never]));
    await gate(...(before("src/bar.ts") as unknown as [never, never]));
    assert.equal(notes.length, 1, "exactly one warning across two edits");
    assert.match(notes[0], /@rqml\/cli/);
  } finally {
    cleanup(root);
  }
});

test("pre-edit gate is dormant for non-edit tools and ungoverned files", async () => {
  const nonEdit = makeContext({ $: fakeShell({ exitCode: 2 }), directory: process.cwd() });
  await preEditGate(nonEdit.ctx)({ tool: "read", sessionID: "s", callID: "c" } as never, { args: { filePath: "x.ts" } } as never);

  const root = tmpProject(); // governed by nothing (only a .git boundary, no spec)
  try {
    const { ctx } = makeContext({ $: fakeShell({ exitCode: 2 }), directory: root });
    await preEditGate(ctx)(...(before("src/foo.ts") as unknown as [never, never])); // no throw: dormant
  } finally {
    cleanup(root);
  }
});

test("TC-SUBAGENT-GAP: the coverage disclosure names the task-tool gap and the CI backstop", () => {
  assert.match(SUBAGENT_COVERAGE_DISCLOSURE, /subagent/i);
  assert.match(SUBAGENT_COVERAGE_DISCLOSURE, /task tool/i);
  assert.match(SUBAGENT_COVERAGE_DISCLOSURE, /\bCI\b/);
  assert.match(SUBAGENT_COVERAGE_DISCLOSURE, /5894/);
});

test(
  "TC-PREIMPL-DENY (integration): real `rqml gate` blocks a non-approved implementation",
  { skip: rqmlAvailable() ? false : "rqml CLI not on PATH" },
  async () => {
    const root = tmpProject();
    try {
      writeFileSync(join(root, "requirements.rqml"), GATE_SPEC);
      writeFileSync(join(root, "foo.ts"), "// implements REQ-DRAFT\n");
      const { ctx } = makeContext({ $: realShell(), directory: root });
      await assert.rejects(
        () => preEditGate(ctx)({ tool: "edit", sessionID: "s", callID: "c" } as never, { args: { filePath: "foo.ts" } } as never),
        /REQ-DRAFT|not approved/i,
      );
    } finally {
      cleanup(root);
    }
  },
);
