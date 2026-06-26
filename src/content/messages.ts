/**
 * User-facing message constants — single sources of truth reused across hooks
 * and (in later stages) the anchor, the status surface, and the docs.
 */

/** The one fail-open notice, with the install command — REQ-HOOK-FAIL-OPEN. */
export const MISSING_CLI_MESSAGE =
  "rqml CLI not found — RQML enforcement is inactive this session. " +
  "Install it with `npm i -g @rqml/cli` (or add @rqml/cli to the project).";

/**
 * The honest boundary of the pre-edit gate — REQ-PREIMPL-COVERAGE-DISCLOSURE.
 * The anchor, the status surface, and the docs all reuse this one statement so
 * the gate's coverage is never oversold (BR-NO-FALSE-ASSURANCE).
 */
export const SUBAGENT_COVERAGE_DISCLOSURE =
  "The pre-edit gate hard-denies edits to code linked to a non-approved " +
  "requirement, but it does not intercept edits made by subagents spawned " +
  "through the task tool (opencode #5894). CI runs the full gate over every " +
  "change and is the authoritative backstop.";
