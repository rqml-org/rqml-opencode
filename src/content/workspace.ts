/**
 * Workspace-anchor content — REQ-HOOK-WORKSPACE (the session-start half).
 *
 * At a workspace root the anchor lists the discovered package specs and points
 * to the workspace gate, rather than going dormant, reusing the same honest
 * posture as the single-spec anchor.
 */
import { ENFORCEMENT_POSTURE, FIVE_STAGE_LOOP } from "./anchor.ts";
import { SUBAGENT_COVERAGE_DISCLOSURE } from "./messages.ts";

export function buildWorkspaceAnchor(statusText: string, unitCount: number): string {
  return [
    "<rqml-anchor>",
    `This is an RQML workspace root governing ${unitCount} package spec(s) — code follows the specifications.`,
    "",
    statusText.trim(),
    "",
    FIVE_STAGE_LOOP,
    ENFORCEMENT_POSTURE,
    SUBAGENT_COVERAGE_DISCLOSURE,
    "Gate every unit at once with `rqml check --workspace`.",
    "</rqml-anchor>",
  ].join("\n");
}
