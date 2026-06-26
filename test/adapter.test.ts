/**
 * Adapter-core tests — Stage 2.
 *
 * Verifies REQ-DISCOVERY, REQ-DORMANT, REQ-CLI-CONTRACT, REQ-HOOK-FAIL-OPEN,
 * REQ-STRICTNESS-RESPECT, and REQ-THIN-ADAPTER (TC-DORMANT, TC-FAIL-OPEN,
 * TC-PARITY). Discovery tests run in throwaway temp projects so they are not
 * influenced by this repository's own requirements.rqml.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  findSpec,
  findSpecForFile,
  classifyExit,
  runRqml,
  rqmlJson,
  readStrictness,
  createWarnOnce,
  type Shell,
  type ShellInvocation,
} from "../src/adapter/index.ts";

// --- helpers -------------------------------------------------------------

const MINIMAL_SPEC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="FIX-001" status="draft">
  <meta><title>Fixture</title><system>fixture</system></meta>
  <requirements>
    <req id="REQ-X" type="FR" title="X" priority="must" status="draft"><statement>The system SHALL do X.</statement></req>
  </requirements>
</rqml>
`;

/** A throwaway project directory, marked as a repo root so discovery stops there. */
function tmpProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "rqml-oc-"));
  mkdirSync(join(dir, ".git"), { recursive: true });
  return dir;
}

/** Reconstruct an argv from a tagged-template call, spreading interpolated arrays. */
function buildArgv(strings: TemplateStringsArray, exprs: unknown[]): string[] {
  const argv: string[] = [];
  const pushText = (text: string) => {
    for (const tok of text.trim().split(/\s+/)) if (tok) argv.push(tok);
  };
  pushText(strings[0]);
  for (let i = 0; i < exprs.length; i++) {
    const expr = exprs[i];
    if (Array.isArray(expr)) for (const item of expr) argv.push(String(item));
    else argv.push(String(expr));
    if (strings[i + 1] !== undefined) pushText(strings[i + 1]);
  }
  return argv;
}

/** A Bun-`$`-shaped stub returning a fixed result, or rejecting (missing CLI). */
function fakeShell(
  result: { exitCode: number; stdout?: string; stderr?: string } | { reject: string },
): Shell {
  const fn = (_s: TemplateStringsArray, ..._e: unknown[]): ShellInvocation => {
    const chain = {
      nothrow: () => chain,
      quiet: () => chain,
      cwd: (_d: string) => chain,
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        ("reject" in result
          ? Promise.reject(new Error(result.reject))
          : Promise.resolve({
              exitCode: result.exitCode,
              stdout: result.stdout ?? "",
              stderr: result.stderr ?? "",
            })
        ).then(onF, onR),
    } as unknown as ShellInvocation;
    return chain;
  };
  return fn as Shell;
}

/** A Bun-`$`-shaped stub that actually runs the command via spawnSync (parity). */
function realShell(): Shell {
  const fn = (strings: TemplateStringsArray, ...exprs: unknown[]): ShellInvocation => {
    const argv = buildArgv(strings, exprs);
    let cwd: string | undefined;
    const run = () => {
      const r = spawnSync(argv[0], argv.slice(1), { cwd, encoding: "utf8" });
      return {
        exitCode: r.error ? 127 : r.status ?? 0,
        stdout: r.stdout ?? "",
        stderr: r.stderr ?? "",
      };
    };
    const chain = {
      nothrow: () => chain,
      quiet: () => chain,
      cwd: (dir: string) => {
        cwd = dir;
        return chain;
      },
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(onF, onR),
    } as unknown as ShellInvocation;
    return chain;
  };
  return fn as Shell;
}

function rqmlAvailable(): boolean {
  const r = spawnSync("rqml", ["--version"], { encoding: "utf8" });
  return !r.error;
}

// --- REQ-DISCOVERY / REQ-DORMANT ----------------------------------------

test("REQ-DISCOVERY: resolves the nearest requirements.rqml from a subdirectory", () => {
  const root = tmpProject();
  try {
    writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
    const deep = join(root, "src", "a", "b");
    mkdirSync(deep, { recursive: true });
    const found = findSpec(deep);
    assert.ok(found, "a governed subdirectory must resolve the project spec");
    assert.equal(found.specPath, join(root, "requirements.rqml"));
    assert.equal(found.specDir, root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("REQ-DORMANT: returns null when no spec governs the directory or its parents", () => {
  const root = tmpProject();
  try {
    const deep = join(root, "src");
    mkdirSync(deep, { recursive: true });
    assert.equal(findSpec(deep), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("REQ-DISCOVERY: requirements.rqml wins; sole *.rqml resolves; a .rqml directory is not a spec", () => {
  const a = tmpProject();
  const b = tmpProject();
  const c = tmpProject();
  try {
    writeFileSync(join(a, "only.rqml"), MINIMAL_SPEC);
    assert.equal(findSpec(a)?.specPath, join(a, "only.rqml"));

    writeFileSync(join(b, "requirements.rqml"), MINIMAL_SPEC);
    writeFileSync(join(b, "other.rqml"), MINIMAL_SPEC);
    assert.equal(findSpec(b)?.specPath, join(b, "requirements.rqml"));

    mkdirSync(join(c, ".rqml"), { recursive: true });
    assert.equal(findSpec(c), null, "a directory named .rqml is not a spec");
  } finally {
    [a, b, c].forEach((d) => rmSync(d, { recursive: true, force: true }));
  }
});

test("findSpecForFile resolves from the edited file's directory", () => {
  const root = tmpProject();
  try {
    writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
    mkdirSync(join(root, "pkg", "src"), { recursive: true });
    const file = join(root, "pkg", "src", "x.ts");
    writeFileSync(file, "");
    assert.equal(findSpecForFile(file)?.specDir, root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- REQ-CLI-CONTRACT (BR-EXIT-CONTRACT) --------------------------------

test("REQ-CLI-CONTRACT: exit codes map to the documented verdicts", () => {
  assert.equal(classifyExit(0), "pass");
  assert.equal(classifyExit(1), "validation");
  assert.equal(classifyExit(2), "blocking");
  assert.equal(classifyExit(64), "usage");
  assert.equal(classifyExit(3), "unknown");
});

test("REQ-THIN-ADAPTER: runRqml relays exit code and output without throwing", async () => {
  const res = await runRqml(fakeShell({ exitCode: 2, stdout: "drift" }), ["check"], { cwd: "/tmp" });
  assert.equal(res.available, true);
  assert.equal(res.exitCode, 2);
  assert.equal(res.verdict, "blocking");
  assert.equal(res.stdout, "drift");
});

test("rqmlJson parses --json stdout, or returns null", async () => {
  const ok = await runRqml(fakeShell({ exitCode: 0, stdout: '{"docId":"X"}' }), ["status", "--json"], { cwd: "/tmp" });
  assert.deepEqual(rqmlJson(ok), { docId: "X" });
  const bad = await runRqml(fakeShell({ exitCode: 0, stdout: "not json" }), ["status"], { cwd: "/tmp" });
  assert.equal(rqmlJson(bad), null);
});

// --- REQ-HOOK-FAIL-OPEN (TC-FAIL-OPEN) ----------------------------------

test("TC-FAIL-OPEN: a missing CLI yields unavailable and never throws", async () => {
  const thrown = await runRqml(fakeShell({ reject: "spawn rqml ENOENT" }), ["check"], { cwd: "/tmp" });
  assert.equal(thrown.available, false);
  assert.equal(thrown.verdict, "unavailable");

  const exit127 = await runRqml(fakeShell({ exitCode: 127, stderr: "command not found" }), ["check"], { cwd: "/tmp" });
  assert.equal(exit127.available, false);
  assert.equal(exit127.verdict, "unavailable");
});

test("REQ-HOOK-FAIL-OPEN: warnOnce emits a notice at most once per key", () => {
  const warn = createWarnOnce();
  let count = 0;
  const emit = () => {
    count += 1;
  };
  assert.equal(warn("no-cli", emit), true);
  assert.equal(warn("no-cli", emit), false);
  assert.equal(warn("other", emit), true);
  assert.equal(count, 2);
});

// --- REQ-STRICTNESS-RESPECT ---------------------------------------------

test("REQ-STRICTNESS-RESPECT: reads declared strictness, walks up, defaults to standard", () => {
  const root = tmpProject();
  const bare = tmpProject();
  try {
    writeFileSync(join(root, "AGENTS.md"), "# Guidelines\n\n## Strictness: `strict`\n");
    const deep = join(root, "src", "x");
    mkdirSync(deep, { recursive: true });
    assert.equal(readStrictness(deep), "strict", "nearest AGENTS.md up the tree wins");
    assert.equal(readStrictness(bare), "standard", "no AGENTS.md declaration -> standard");
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(bare, { recursive: true, force: true });
  }
});

// --- TC-PARITY (REQ-THIN-ADAPTER) ---------------------------------------

test(
  "TC-PARITY: runRqml relays the bare `rqml check` verdict unchanged",
  { skip: rqmlAvailable() ? false : "rqml CLI not on PATH" },
  async () => {
    const root = tmpProject();
    try {
      writeFileSync(join(root, "requirements.rqml"), MINIMAL_SPEC);
      const bare = spawnSync("rqml", ["check"], { cwd: root, encoding: "utf8" });
      const viaAdapter = await runRqml(realShell(), ["check"], { cwd: root });
      assert.equal(viaAdapter.exitCode, bare.status, "adapter exit code must equal the bare CLI");
      assert.equal(viaAdapter.stdout.trim(), (bare.stdout ?? "").trim(), "adapter stdout must equal the bare CLI");
      assert.equal(viaAdapter.available, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);
