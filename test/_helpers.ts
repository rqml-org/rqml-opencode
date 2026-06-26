/**
 * Shared test helpers (not a *.test.ts file, so it is imported, never run).
 *
 * Provides throwaway temp projects, Bun-`$`-shaped shell stubs (fixed-result and
 * real-spawnSync variants), and a HookContext builder so hook handlers can be
 * exercised in isolation.
 */
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { createWarnOnce, type Shell, type ShellInvocation } from "../src/adapter/index.ts";
import type { HookContext } from "../src/hooks/context.ts";

export const MINIMAL_SPEC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="FIX-001" status="draft">
  <meta><title>Fixture</title><system>fixture</system></meta>
  <requirements>
    <req id="REQ-X" type="FR" title="X" priority="must" status="draft"><statement>The system SHALL do X.</statement></req>
  </requirements>
</rqml>
`;

/** A throwaway project directory, marked as a repo root so discovery stops there. */
export function tmpProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "rqml-oc-"));
  mkdirSync(join(dir, ".git"), { recursive: true });
  return dir;
}

export function cleanup(...dirs: string[]): void {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
}

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
export function fakeShell(
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

/** A Bun-`$`-shaped stub that actually runs the command via spawnSync. */
export function realShell(): Shell {
  const fn = (strings: TemplateStringsArray, ...exprs: unknown[]): ShellInvocation => {
    const argv = buildArgv(strings, exprs);
    let cwd: string | undefined;
    const run = () => {
      const r = spawnSync(argv[0], argv.slice(1), { cwd, encoding: "utf8" });
      return { exitCode: r.error ? 127 : r.status ?? 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
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

export function rqmlAvailable(): boolean {
  const r = spawnSync("rqml", ["--version"], { encoding: "utf8" });
  return !r.error;
}

/** Build a HookContext for tests, capturing notify() messages. */
export function makeContext(opts: { $: Shell; directory: string }): {
  ctx: HookContext;
  notes: string[];
} {
  const notes: string[] = [];
  const ctx: HookContext = {
    $: opts.$,
    directory: opts.directory,
    warnOnce: createWarnOnce(),
    notify: (message) => notes.push(message),
  };
  return { ctx, notes };
}
