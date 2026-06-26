/**
 * Hook assembly for the rqml-opencode plugin.
 *
 * `createHooks` builds the Hooks object the factory returns (REQ-PLUGIN-FACTORY),
 * assembling the shared per-session context once and wiring each handler. Stage 3
 * adds the tool-boundary hooks; later stages from .rqml/plan.md add more:
 *   - tool.execute.before  pre-edit approval gate   (Stage 3, ADR-0001) ✓
 *   - tool.execute.after   spec-edit validation      (Stage 3) ✓
 *   - experimental.chat.system.transform  session anchor (Stage 4, ADR-0003)
 *   - event                advisory idle check        (Stage 5, ADR-0002)
 *   - config               zero-touch registration    (Stage 8, ADR-0003)
 */
import type { Hooks, Plugin } from "@opencode-ai/plugin";

import { createWarnOnce, type Shell } from "../adapter/index.ts";
import type { HookContext } from "./context.ts";
import { preEditGate } from "./pre-edit.ts";
import { specEditValidate } from "./spec-validate.ts";

/** The single argument every opencode plugin factory receives. */
type PluginInput = Parameters<Plugin>[0];

export function createHooks(input: PluginInput): Hooks {
  const ctx: HookContext = {
    $: input.$ as unknown as Shell,
    directory: input.directory,
    warnOnce: createWarnOnce(),
    notify: (message) => console.error(`[rqml] ${message}`),
  };

  return {
    "tool.execute.before": preEditGate(ctx),
    "tool.execute.after": specEditValidate(ctx),
  };
}
