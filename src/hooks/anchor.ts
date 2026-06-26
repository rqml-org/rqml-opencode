/**
 * Session anchor — REQ-HOOK-ANCHOR, REQ-ENFORCEMENT-HONESTY, REQ-EXPERIMENTAL-API-RISK,
 * ADR-0002, ADR-0003.
 *
 * Injects a freshly computed `rqml status` summary (plus the five-stage loop and
 * the honest enforcement posture) into the model. Two dynamic channels are
 * coordinated so the anchor is delivered exactly once per request:
 *
 *  - experimental.chat.system.transform (preferred): pushes the anchor onto the
 *    system-prompt array every request. The status is computed once per session
 *    and cached, so only the first request shells out.
 *  - chat.message (fallback): on a host that does NOT support the experimental
 *    hook, prepends the anchor to the first user message, once per session.
 *
 * Because chat.message fires before system.transform within a turn, the fallback
 * defers as soon as the experimental hook has been observed to run. Both bodies
 * are guarded (REQ-EXPERIMENTAL-API-RISK): a shape change degrades to nothing,
 * never a crash. When the project is ungoverned (REQ-DORMANT) or the CLI is
 * missing (REQ-HOOK-FAIL-OPEN), no anchor is injected.
 */
import type { Hooks } from "@opencode-ai/plugin";

import { findSpec, guarded, runRqml, workspaceStatus } from "../adapter/index.ts";
import { buildAnchor } from "../content/anchor.ts";
import { buildWorkspaceAnchor } from "../content/workspace.ts";
import { MISSING_CLI_MESSAGE } from "../content/messages.ts";
import type { HookContext } from "./context.ts";

type SystemTransform = NonNullable<Hooks["experimental.chat.system.transform"]>;
type ChatMessage = NonNullable<Hooks["chat.message"]>;

const DEGRADED_MESSAGE =
  "RQML anchor injection is unavailable on this opencode build; relying on static instructions and CI.";

export interface AnchorHooks {
  systemTransform: SystemTransform;
  chatMessage: ChatMessage;
}

export function createAnchor(ctx: HookContext): AnchorHooks {
  /** Per-session anchor text (string = anchor, null = governed but un-anchorable). */
  const cache = new Map<string, string | null>();
  const messageSeen = new Set<string>();
  const deliveredViaMessage = new Set<string>();
  let hostSupportsSystemTransform = false;

  async function computeAnchor(sessionID: string): Promise<string | null> {
    if (cache.has(sessionID)) return cache.get(sessionID) ?? null;

    const loc = findSpec(ctx.directory);
    if (!loc) {
      // No single governing spec — this may be a workspace root with specs
      // beneath it (REQ-HOOK-WORKSPACE). Delegate discovery to the CLI; list the
      // units when there are any, otherwise the project is ungoverned (dormant).
      const ws = await workspaceStatus(ctx.$, ctx.directory);
      const anchor = ws.available && ws.unitCount > 0 ? buildWorkspaceAnchor(ws.result.stdout, ws.unitCount) : null;
      cache.set(sessionID, anchor); // cache either way: probe the workspace at most once per session
      return anchor;
    }

    const result = await runRqml(ctx.$, ["status"], { cwd: loc.specDir });
    if (!result.available) {
      ctx.warnOnce("rqml-missing", () => ctx.notify(MISSING_CLI_MESSAGE));
      cache.set(sessionID, null); // give up for this session; do not respawn each request
      return null;
    }

    const anchor = buildAnchor(result.stdout);
    cache.set(sessionID, anchor);
    return anchor;
  }

  const onError = () =>
    ctx.warnOnce("anchor-degraded", () => ctx.notify(DEGRADED_MESSAGE));

  const systemTransform: SystemTransform = guarded(async (input, output) => {
    hostSupportsSystemTransform = true;
    const anchor = await computeAnchor(input.sessionID ?? "");
    if (anchor) output.system.push(anchor);
  }, onError);

  const chatMessage: ChatMessage = guarded(async (input, output) => {
    const sessionID = input.sessionID;
    const firstMessage = !messageSeen.has(sessionID);
    messageSeen.add(sessionID);
    // chat.message is the fallback for hosts that lack system.transform; it fires
    // BEFORE system.transform within a turn, so on the first message we cannot yet
    // tell whether the experimental hook will deliver the anchor. Defer on the
    // first message (avoiding a double injection on a host that supports both) and
    // fall back only once a prior turn has shown the experimental hook never ran.
    if (hostSupportsSystemTransform || firstMessage) return;
    if (deliveredViaMessage.has(sessionID)) return;

    const anchor = await computeAnchor(sessionID);
    if (!anchor) return;
    deliveredViaMessage.add(sessionID);

    const parts = output.parts as unknown as Array<{ type?: unknown; text?: unknown }>;
    const firstText = parts.find((part) => part.type === "text" && typeof part.text === "string");
    if (firstText) firstText.text = `${anchor}\n\n${String(firstText.text)}`;
  }, onError);

  return { systemTransform, chatMessage };
}
