/**
 * Vendored authoring craft — REQ-SKILL-AUTHORING, REQ-CRAFT-GUARD,
 * DEC-VENDOR-CRAFT, rqml-skill ADR-0009.
 *
 * The authoring craft is canonical in rqml-skill and vendored here at craft/*.md
 * for offline, in-context use; it is contributed to the model as instruction
 * files by the config hook (Stage 8). The plugin re-expresses no craft of its
 * own — do not edit craft/*.md locally; change them upstream and let craft-sync
 * propagate. checkDrift backs the CI drift guard.
 */
import { fileURLToPath } from "node:url";

/** The canonical home of the craft (raw rqml-skill references). */
export const CANONICAL_BASE = "https://raw.githubusercontent.com/rqml-org/rqml-skill/main/references";

/** The vendored reference file names. */
export const CRAFT_REFS = ["authoring.md", "monorepo.md"] as const;

/** Absolute paths to the vendored craft files, for config.instructions (Stage 8). */
export const CRAFT_FILES: string[] = CRAFT_REFS.map((name) =>
  fileURLToPath(new URL(`../../craft/${name}`, import.meta.url)),
);

export type DriftStatus = "ok" | "drifted" | "skipped";

/**
 * Compare a vendored copy to its canonical source — REQ-CRAFT-GUARD. A null
 * canonical (the source was unreachable) is skipped, never failed, so an offline
 * environment does not produce a spurious failure.
 */
export function checkDrift(vendored: string, canonical: string | null): DriftStatus {
  if (canonical === null) return "skipped";
  return vendored === canonical ? "ok" : "drifted";
}
