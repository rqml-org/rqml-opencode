/**
 * Hook assembly for the rqml-opencode plugin.
 *
 * `createHooks` builds the Hooks object the factory returns (REQ-PLUGIN-FACTORY).
 * At Stage 1 it returns an empty Hooks object: the factory is conformant and
 * inert until later stages add the handlers from .rqml/plan.md —
 *   - `tool.execute.before`            pre-edit approval gate (Stage 3, ADR-0001)
 *   - `tool.execute.after`             spec-edit validation   (Stage 3)
 *   - `experimental.chat.system.transform` session anchor     (Stage 4, ADR-0003)
 *   - `event`                          advisory idle check    (Stage 5, ADR-0002)
 *   - `config`                         zero-touch registration (Stage 8, ADR-0003)
 *
 * Keeping the assembly in one place lets the factory stay a thin wrapper and
 * lets each later stage add exactly one handler here.
 */
import type { Hooks, Plugin } from "@opencode-ai/plugin";

/** The single argument every opencode plugin factory receives. */
type PluginInput = Parameters<Plugin>[0];

export function createHooks(_input: PluginInput): Hooks {
  // Stage 1: no handlers registered yet. The factory is conformant and dormant.
  return {};
}
