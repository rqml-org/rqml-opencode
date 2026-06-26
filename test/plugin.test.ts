/**
 * TC-MANIFEST — verifies REQ-MANIFEST and REQ-PLUGIN-FACTORY.
 *
 * The factory must construct without error, return the documented Hooks
 * object, and perform no rqml CLI invocation on construction (a governed
 * project's verdicts come only from hooks firing, never from loading the
 * plugin — REQ-DORMANT, REQ-THIN-ADAPTER). Runs directly on the TypeScript
 * source via Node's native type stripping; no build step required.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import RqmlPlugin, { RqmlPlugin as named } from "../src/index.ts";

/**
 * A stand-in for opencode's plugin input. The Bun `$` shell is a counting
 * stub: if the factory shells out to rqml on construction, the count rises and
 * the test fails.
 */
function makeInput() {
  let shellCalls = 0;
  const $ = new Proxy(function () {}, {
    apply() {
      shellCalls += 1;
      return Promise.resolve({ stdout: "", stderr: "", exitCode: 0 });
    },
  });
  const input = {
    client: {},
    project: { id: "test", worktree: process.cwd() },
    directory: process.cwd(),
    worktree: process.cwd(),
    serverUrl: new URL("http://localhost:0"),
    experimental_workspace: { register() {} },
    $,
  };
  return { input, shellCalls: () => shellCalls };
}

test("TC-MANIFEST: factory constructs and returns a Hooks object", async () => {
  const { input } = makeInput();
  const hooks = await (RqmlPlugin as Function)(input, undefined);
  assert.equal(typeof hooks, "object", "factory must return a Hooks object");
  assert.notEqual(hooks, null, "Hooks object must not be null");
});

test("TC-MANIFEST: factory invokes no rqml CLI on construction", async () => {
  const { input, shellCalls } = makeInput();
  await (RqmlPlugin as Function)(input, undefined);
  assert.equal(shellCalls(), 0, "the factory must not invoke the rqml CLI on construction");
});

test("TC-MANIFEST: default and named exports are the same factory", () => {
  assert.equal(RqmlPlugin, named, "default export and named RqmlPlugin must match");
  assert.equal(typeof RqmlPlugin, "function", "the export must be a plugin factory function");
});
