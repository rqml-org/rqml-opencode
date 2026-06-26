/**
 * Workspace fan-out helper — REQ-HOOK-WORKSPACE.
 *
 * At a spec-less monorepo root the plugin cannot tell a workspace root (package
 * specs beneath it) from a truly ungoverned directory without the CLI, so
 * discovery is delegated to `rqml ... --workspace` and never reimplemented here.
 * The CLI reports a `workspace <cmd>: N spec(s)` summary; 0 specs means
 * ungoverned. A non-zero aggregate exit means at least one unit failed.
 */
import { runRqml, type RqmlResult, type Shell } from "./cli.ts";

export interface WorkspaceSummary {
  /** False when the CLI is missing — the caller must stay silent (REQ-HOOK-WORKSPACE). */
  available: boolean;
  /** Number of package specs the CLI discovered beneath the directory. */
  unitCount: number;
  /** Whether the aggregate workspace gate failed (a unit did not pass). */
  failed: boolean;
  result: RqmlResult;
}

function summarize(result: RqmlResult): WorkspaceSummary {
  if (!result.available) return { available: false, unitCount: 0, failed: false, result };
  const match = result.stdout.match(/workspace \w+:\s*(\d+)\s+spec/);
  const unitCount = match ? Number(match[1]) : 0;
  return { available: true, unitCount, failed: result.exitCode !== 0, result };
}

/** Run the aggregate workspace gate (`rqml check --workspace`). */
export async function workspaceCheck($: Shell, dir: string, strictness: string): Promise<WorkspaceSummary> {
  return summarize(await runRqml($, ["check", "--workspace", "--strictness", strictness], { cwd: dir }));
}

/** Run the aggregate workspace status (`rqml status --workspace`), to list units. */
export async function workspaceStatus($: Shell, dir: string): Promise<WorkspaceSummary> {
  return summarize(await runRqml($, ["status", "--workspace"], { cwd: dir }));
}
