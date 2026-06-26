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
import type { HookContext, PluginClient } from "../src/hooks/context.ts";

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
    let nothrow = false;
    const chain = {
      nothrow: () => {
        nothrow = true;
        return chain;
      },
      quiet: () => chain,
      cwd: (_d: string) => chain,
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
        if ("reject" in result) return Promise.reject(new Error(result.reject)).then(onF, onR);
        // Model Bun's `$`: a non-zero exit throws unless `.nothrow()` was chained.
        if (result.exitCode !== 0 && !nothrow) {
          return Promise.reject(new Error(`exited ${result.exitCode}`)).then(onF, onR);
        }
        return Promise.resolve({
          exitCode: result.exitCode,
          stdout: result.stdout ?? "",
          stderr: result.stderr ?? "",
        }).then(onF, onR);
      },
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

/**
 * The `skip` value for a real-CLI integration test: run when rqml is available,
 * skip when it is absent — UNLESS RQML_REQUIRE_CLI is set (CI), where it returns
 * `false` so the test runs and hard-fails instead of silently skipping.
 */
export function cliSkip(): false | string {
  if (rqmlAvailable()) return false;
  return process.env.RQML_REQUIRE_CLI ? false : "rqml CLI not on PATH";
}

/** Build a HookContext for tests, capturing notify() messages, toasts, and prompts. */
export function makeContext(opts: { $: Shell; directory: string; toastShown?: boolean }): {
  ctx: HookContext;
  notes: string[];
  toasts: Array<{ message: string; variant?: string }>;
  prompts: Array<{ path: { id: string }; body: { parts: Array<{ type: string; text: string }> } }>;
} {
  const notes: string[] = [];
  const toasts: Array<{ message: string; variant?: string }> = [];
  const prompts: Array<{ path: { id: string }; body: { parts: Array<{ type: string; text: string }> } }> = [];
  const toastShown = opts.toastShown ?? true;
  const client: PluginClient = {
    tui: {
      showToast: async (o) => {
        toasts.push(o.body);
        return toastShown;
      },
    },
    session: {
      prompt: async (o) => {
        prompts.push(o as (typeof prompts)[number]);
        return {};
      },
    },
  };
  const ctx: HookContext = {
    $: opts.$,
    directory: opts.directory,
    client,
    warnOnce: createWarnOnce(),
    notify: (message) => notes.push(message),
  };
  return { ctx, notes, toasts, prompts };
}
