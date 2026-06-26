/**
 * Run-mode gating for the soft continuation — REQ-TURN-END-CHECK, ADR-0002,
 * DEC-SOFT-TURN-END.
 *
 * opencode cannot block turn-end, so the idle check is advisory. A soft
 * continuation prompt (re-engaging the agent) is only safe in a long-lived
 * interactive (TUI/server) session — in headless `opencode run` it races process
 * teardown — so it is gated on a live surface being present, which a shown toast
 * confirms. An explicit env opt-out disables it everywhere.
 */
export function softPromptAllowed(toastShown: boolean): boolean {
  if (process.env.RQML_NO_SOFT_PROMPT) return false;
  return toastShown;
}
