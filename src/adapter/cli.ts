/**
 * rqml CLI bridge — REQ-THIN-ADAPTER, REQ-CLI-CONTRACT, REQ-HOOK-FAIL-OPEN.
 *
 * Every verdict the plugin surfaces originates here: the adapter shells out to
 * the rqml CLI through the injected Bun `$` and relays the result. It never
 * parses or evaluates RQML, and it never throws — a missing or broken CLI
 * resolves to `available: false` so callers fail open (BR-NEVER-BRICK).
 */

/** The subset of the Bun shell the adapter depends on (opencode's `input.$`). */
export interface ShellOutput {
  exitCode: number;
  stdout: unknown;
  stderr: unknown;
}
export interface ShellInvocation extends PromiseLike<ShellOutput> {
  nothrow(): ShellInvocation;
  quiet(): ShellInvocation;
  cwd(dir: string): ShellInvocation;
}
export type Shell = (strings: TemplateStringsArray, ...exprs: unknown[]) => ShellInvocation;

export type Verdict =
  | "pass"
  | "validation"
  | "blocking"
  | "usage"
  | "unknown"
  | "unavailable";

export interface RqmlResult {
  /** False when the CLI is missing or could not be spawned — fail open. */
  available: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  verdict: Verdict;
}

/**
 * The @rqml/cli semver range whose documented exit-code and JSON contract this
 * adapter targets — REQ-CLI-CONTRACT. The plugin consumes only that stable
 * surface (exit codes 0/1/2/64 and the status/check JSON shapes).
 */
export const RQML_CLI_RANGE = ">=0.1.0 <1.0.0";

/** The rqml executable the adapter invokes. */
const RQML_BIN = "rqml";

/**
 * Map a documented rqml exit code to a verdict — BR-EXIT-CONTRACT. 0 proceed;
 * 1 validation failure; 2 blocking drift or coverage; 64 the plugin invoked the
 * CLI incorrectly (its own bug, not the user's).
 */
export function classifyExit(code: number): Verdict {
  switch (code) {
    case 0:
      return "pass";
    case 1:
      return "validation";
    case 2:
      return "blocking";
    case 64:
      return "usage";
    default:
      return "unknown";
  }
}

function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return String(value); // a Node Buffer stringifies to its utf-8 text
}

/**
 * Run the rqml CLI in `opts.cwd` and relay the result. Never throws: a spawn
 * failure or a 127 ("command not found") yields `available: false` so the
 * caller can fail open (REQ-HOOK-FAIL-OPEN). `args` is passed through the Bun
 * shell, which escapes each element.
 */
export async function runRqml(
  $: Shell,
  args: string[],
  opts: { cwd: string },
): Promise<RqmlResult> {
  let out: ShellOutput;
  try {
    out = await $`${RQML_BIN} ${args}`.cwd(opts.cwd).nothrow().quiet();
  } catch (err) {
    return {
      available: false,
      exitCode: null,
      stdout: "",
      stderr: asString((err as { message?: unknown })?.message),
      verdict: "unavailable",
    };
  }

  const exitCode = out.exitCode;
  const stdout = asString(out.stdout);
  const stderr = asString(out.stderr);

  if (exitCode === 127) {
    return { available: false, exitCode, stdout, stderr, verdict: "unavailable" };
  }
  return { available: true, exitCode, stdout, stderr, verdict: classifyExit(exitCode) };
}

/** Parse the stdout of a `--json` rqml invocation, or null if it is not JSON. */
export function rqmlJson(result: RqmlResult): unknown {
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}
