/**
 * Advisory turn-end check — REQ-TURN-END-CHECK, REQ-HOOK-WORKSPACE,
 * REQ-ENFORCEMENT-HONESTY, ADR-0002, DEC-SOFT-TURN-END.
 *
 * opencode cannot block a turn from ending (CON-NO-STOP-GATE) and the `event`
 * hook is fire-and-forget, so on session.idle this hook runs `rqml check` and
 * surfaces any failure ADVISORILY — a toast plus, only in an interactive
 * session, a soft continuation prompt — but NEVER blocks and never claims to
 * (BR-NO-FALSE-ASSURANCE). CI runs the same gate and is authoritative
 * (REQ-CI-PARITY). At a spec-less workspace root it runs the aggregate
 * `rqml check --workspace` instead, staying silent when the CLI is unavailable.
 * Surfacing is idempotent per session so an unchanged verdict is not repeated.
 */
import type { Hooks } from "@opencode-ai/plugin";

import { findSpec, guarded, readStrictness, runRqml } from "../adapter/index.ts";
import { formatDiagnostics } from "../adapter/diagnostics.ts";
import { workspaceCheck } from "../adapter/workspace.ts";
import { softPromptAllowed } from "../adapter/run-mode.ts";
import { MISSING_CLI_MESSAGE } from "../content/messages.ts";
import type { HookContext } from "./context.ts";

type EventHook = NonNullable<Hooks["event"]>;

const TOAST =
  "RQML check did not pass (advisory). The turn is not blocked; CI runs the same gate and is " +
  "authoritative. Resolve the findings before merging.";

export function createIdleCheck(ctx: HookContext): EventHook {
  const lastSurfaced = new Map<string, string>();

  async function surface(sessionID: string, banner: string): Promise<void> {
    if (lastSurfaced.get(sessionID) === banner) return; // idempotent — same verdict already shown
    lastSurfaced.set(sessionID, banner);

    let toastShown = false;
    try {
      const shown = await ctx.client.tui.showToast({ body: { message: TOAST, variant: "warning" } });
      toastShown = shown !== false;
    } catch {
      toastShown = false;
    }
    const willSoftPrompt = Boolean(sessionID) && softPromptAllowed(toastShown);
    // Always keep the verbatim diagnostics reachable: the soft prompt carries them
    // to the agent when issued; otherwise log them, so a flagged check is never
    // reduced to a content-free toast (REQ-HOOK-DIAGNOSTICS).
    if (!willSoftPrompt) ctx.notify(banner);

    if (willSoftPrompt) {
      try {
        await ctx.client.session.prompt({
          path: { id: sessionID },
          body: {
            parts: [
              {
                type: "text",
                text: `${banner}\n\nThis is advisory — resolve the findings or capture them; CI enforces the same gate.`,
              },
            ],
          },
        });
      } catch {
        // The soft continuation is best-effort; it races teardown in headless run.
      }
    }
  }

  return guarded(async ({ event }: { event: { type?: unknown; properties?: unknown } }) => {
    if (event?.type !== "session.idle") return;
    const props = event.properties as { sessionID?: unknown } | undefined;
    const sessionID = typeof props?.sessionID === "string" ? props.sessionID : "";

    const loc = findSpec(ctx.directory);
    if (loc) {
      const strictness = readStrictness(loc.specDir);
      const result = await runRqml(ctx.$, ["check", "--strictness", strictness], { cwd: loc.specDir });
      if (!result.available) {
        ctx.warnOnce("rqml-missing", () => ctx.notify(MISSING_CLI_MESSAGE));
        return; // fail open
      }
      if (result.verdict === "pass") {
        lastSurfaced.delete(sessionID);
        return; // quiet on pass (TC-IDLE-QUIET)
      }
      await surface(
        sessionID,
        formatDiagnostics(
          "check failed — advisory; the turn is not blocked and CI runs the same gate",
          result,
          `rqml check --strictness ${strictness}`,
        ),
      );
      return;
    }

    // No single governing spec — this may be a workspace root. Delegate to the CLI.
    const ws = await workspaceCheck(ctx.$, ctx.directory, readStrictness(ctx.directory));
    if (!ws.available || !ws.failed) {
      lastSurfaced.delete(sessionID); // CLI missing, ungoverned, or workspace passing -> silent
      return;
    }
    await surface(
      sessionID,
      formatDiagnostics("workspace check failed — advisory; CI runs the same gate", ws.result, "rqml check --workspace"),
    );
  }, () => ctx.warnOnce("idle-degraded", () => ctx.notify("RQML idle check failed unexpectedly; it is advisory and was skipped.")));
}
