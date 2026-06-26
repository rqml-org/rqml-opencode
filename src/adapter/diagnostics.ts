/**
 * Diagnostics formatting — REQ-HOOK-DIAGNOSTICS, BR-SHOW-YOUR-WORK.
 *
 * Every denial and every validation failure carries the CLI's own output
 * verbatim plus the exact command that reproduces it, so the agent and the
 * developer can act on the verdict and re-run it.
 */
import type { RqmlResult } from "./cli.ts";

/** A verbatim, reproducible diagnostics block built from a CLI result. */
export function formatDiagnostics(title: string, result: RqmlResult, reproduce: string): string {
  const body = [result.stdout, result.stderr]
    .map((stream) => stream.trim())
    .filter((stream) => stream.length > 0)
    .join("\n");
  return [
    `RQML — ${title}`,
    "",
    body || "(the CLI emitted no diagnostics)",
    "",
    `Reproduce: ${reproduce}`,
  ].join("\n");
}
