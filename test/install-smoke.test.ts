/**
 * Installed-layout smoke test — Stage 8 (REQ-INSTALL-SMOKE).
 *
 * Loads the assembled plugin from the package entry, drives its config hook, and
 * checks that the contributions (MCP server, commands, craft instructions) take
 * effect and the plugin tools are exposed — proving the export shape, hook
 * assembly, and registration work together without a live opencode host.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import RqmlPlugin from "../src/index.ts";
import { MINIMAL_SPEC, tmpProject, cleanup, fakeShell } from "./_helpers.ts";

function makeInput(dir: string) {
  return {
    client: { tui: { showToast: async () => true }, session: { prompt: async () => ({}) } },
    project: { id: "smoke", worktree: dir },
    directory: dir,
    worktree: dir,
    serverUrl: new URL("http://localhost:0"),
    experimental_workspace: { register() {} },
    $: fakeShell({ exitCode: 0 }),
  };
}

test("REQ-INSTALL-SMOKE: the assembled plugin exposes every hook and registers its contributions", async () => {
  const root = tmpProject();
  try {
    writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
    const hooks = (await (RqmlPlugin as (i: unknown) => Promise<Record<string, unknown>>)(makeInput(root)));

    for (const key of [
      "tool.execute.before",
      "tool.execute.after",
      "experimental.chat.system.transform",
      "chat.message",
      "event",
      "tool",
      "config",
    ]) {
      assert.ok(key in hooks, `the assembled plugin exposes the ${key} hook`);
    }

    // The config hook registers the contributions into a resolved config.
    const cfg: Record<string, any> = {};
    await (hooks.config as (c: unknown) => Promise<void>)(cfg);
    assert.deepEqual(cfg.mcp.rqml.command, ["npx", "-y", "@rqml/mcp"], "MCP server registered");
    assert.ok(cfg.command["rqml-init"] && cfg.command["rqml-check"], "command surfaces registered");
    assert.equal(cfg.instructions.length, 2, "craft instructions registered (governed project)");

    // The command surfaces are also exposed as plugin tools.
    const tools = hooks.tool as Record<string, unknown>;
    assert.ok(tools.rqml_wf_check && tools.rqml_wf_init, "command surfaces exposed as plugin tools");
  } finally {
    cleanup(root);
  }
});
