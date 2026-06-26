/**
 * Config-hook registration tests — Stage 8 (ADR-0003).
 *
 * Verifies REQ-CONFIG-HOOK-REGISTER, REQ-MCP-BUNDLED, REQ-NO-RESIDUE, and the
 * registration half of REQ-EXPERIMENTAL-API-RISK (TC-CONFIG-REGISTER,
 * TC-API-ABSENT).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { registerContributions } from "../src/adapter/register.ts";
import { createConfigHook } from "../src/hooks/config.ts";
import { MINIMAL_SPEC, tmpProject, cleanup, fakeShell, makeContext } from "./_helpers.ts";

test("TC-CONFIG-REGISTER: registers the MCP server, all commands, and craft instructions", () => {
  const cfg: Record<string, any> = {};
  const added = registerContributions(cfg, { craft: true });

  assert.equal(cfg.mcp.rqml.type, "local");
  assert.deepEqual(cfg.mcp.rqml.command, ["npx", "-y", "@rqml/mcp"]);
  assert.equal(Object.keys(cfg.command).length, 6);
  assert.ok(cfg.command["rqml-check"], "the command surfaces are registered");
  assert.equal(cfg.instructions.length, 2);
  assert.ok(cfg.instructions.every((p: string) => p.endsWith(".md")), "craft files registered as instructions");

  assert.ok(added.mcp);
  assert.equal(added.commands.length, 6);
  assert.equal(added.instructions.length, 2);
});

test("REQ-CONFIG-HOOK-REGISTER: never clobbers existing user entries", () => {
  const cfg: Record<string, any> = {
    mcp: { rqml: { type: "remote", url: "https://mine" } },
    command: { "rqml-check": { template: "mine", description: "mine" } },
    instructions: [],
  };
  const added = registerContributions(cfg, { craft: false });

  assert.equal(cfg.mcp.rqml.type, "remote", "the user's MCP entry is preserved");
  assert.equal(cfg.command["rqml-check"].template, "mine", "the user's command is preserved");
  assert.equal(added.mcp, false);
  assert.ok(!added.commands.includes("rqml-check"));
});

test("craft instructions are gated: craft=false adds the server and commands but no instructions", () => {
  const cfg: Record<string, any> = {};
  registerContributions(cfg, { craft: false });
  assert.ok(cfg.mcp.rqml, "MCP still registered");
  assert.equal((cfg.instructions ?? []).length, 0, "no craft instructions when gated off");
});

test("config hook adds craft instructions only inside a governed project", async () => {
  const gov = tmpProject();
  const ungov = tmpProject();
  try {
    writeFileSync(join(gov, "requirements.rqml"), MINIMAL_SPEC);

    const cfgG: Record<string, any> = {};
    await createConfigHook(makeContext({ $: fakeShell({ exitCode: 0 }), directory: gov }).ctx)(cfgG as never);
    assert.equal(cfgG.instructions.length, 2, "governed project -> craft instructions registered");

    const cfgU: Record<string, any> = {};
    await createConfigHook(makeContext({ $: fakeShell({ exitCode: 0 }), directory: ungov }).ctx)(cfgU as never);
    assert.ok(cfgU.mcp.rqml, "MCP registered even in an ungoverned project");
    assert.equal((cfgU.instructions ?? []).length, 0, "ungoverned -> no eager craft instructions");
  } finally {
    cleanup(gov, ungov);
  }
});

test("TC-API-ABSENT: an unwritable config degrades to the manual fallback, never throws", async () => {
  const root = tmpProject();
  try {
    writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
    const { ctx, notes } = makeContext({ $: fakeShell({ exitCode: 0 }), directory: root });
    const frozen = Object.freeze({}); // assigning cfg.mcp throws on a frozen object
    await createConfigHook(ctx)(frozen as never); // must not throw
    assert.equal(notes.length, 1, "warned once");
    assert.match(notes[0], /opencode\.json|manually/i, "points at the manual fallback");
  } finally {
    cleanup(root);
  }
});

test("REQ-NO-RESIDUE: registration is in-memory only and writes no files", () => {
  const root = tmpProject();
  try {
    const before = readdirSync(root).sort();
    registerContributions({}, { craft: true });
    assert.deepEqual(readdirSync(root).sort(), before, "registration creates no on-disk residue");
  } finally {
    cleanup(root);
  }
});
