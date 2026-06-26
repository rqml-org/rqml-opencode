/**
 * Session-anchor content — REQ-HOOK-ANCHOR, REQ-ENFORCEMENT-HONESTY,
 * GOAL-HONEST-POSTURE.
 *
 * Wraps the CLI's own compact `rqml status` summary with the five-stage loop and
 * the honest enforcement posture, so the agent starts anchored on the spec and
 * is told the truth about what is enforced in-session. ENFORCEMENT_POSTURE is the
 * single source of truth reused by the status surface (Stage 6) and the docs
 * (Stage 9).
 */
import { SUBAGENT_COVERAGE_DISCLOSURE } from "./messages.ts";

export const FIVE_STAGE_LOOP =
  "Loop: Spec (requirements.rqml) -> Design (ADRs in .rqml/adr/) -> Plan (.rqml/plan.md) " +
  "-> Code (rqml show / rqml impact / implement / rqml link) -> Verify (rqml check must pass).";

/** The honest account of what the plugin enforces on opencode — REQ-ENFORCEMENT-HONESTY. */
export const ENFORCEMENT_POSTURE =
  "Enforcement on opencode: an edit to code implementing a NON-APPROVED requirement is " +
  "hard-blocked at the tool boundary. The turn-end `rqml check` is ADVISORY — it surfaces " +
  "findings but cannot block a turn from ending; CI runs the same gate and is the " +
  "authoritative verdict.";

/** Build the anchor block from a compact `rqml status` summary. */
export function buildAnchor(statusText: string): string {
  return [
    "<rqml-anchor>",
    "This project is governed by RQML — code follows the specification, not the reverse.",
    "",
    statusText.trim(),
    "",
    FIVE_STAGE_LOOP,
    ENFORCEMENT_POSTURE,
    SUBAGENT_COVERAGE_DISCLOSURE,
    "Re-anchor anytime with `rqml status`; run `rqml check` before finishing.",
    "</rqml-anchor>",
  ].join("\n");
}
