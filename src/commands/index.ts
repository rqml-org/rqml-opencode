/**
 * Command-surface delivery — REQ-COMMAND-SURFACES, ADR-0004, DEC-COMMAND-SURFACES.
 *
 * opencode has no plugin-distributable command bundle, so the surfaces ship
 * through more than one channel for resilience:
 *  - as opencode JSON commands (`config.command[<slash>]`), injected by the
 *    config hook (Stage 8) so the developer can type `/rqml-check`;
 *  - as plugin tools (`rqml_wf_<key>`) the agent can call directly — the
 *    always-available form, named so they never collide with the @rqml/mcp
 *    atomic tools (rqml_check, rqml_status, ...).
 *
 * The plugin `tool` helper is an identity function, so a ToolDefinition is just
 * a plain object — no runtime dependency on @opencode-ai/plugin is taken.
 */
import type { Hooks } from "@opencode-ai/plugin";

import { COMMANDS } from "./templates.ts";

export { COMMANDS } from "./templates.ts";
export type { CommandSurface } from "./templates.ts";

type ToolDefinition = NonNullable<Hooks["tool"]>[string];

export interface ConfigCommand {
  template: string;
  description: string;
}

/** The opencode config.command map (registered by the config hook, Stage 8). */
export function toConfigCommands(): Record<string, ConfigCommand> {
  const commands: Record<string, ConfigCommand> = {};
  for (const cmd of COMMANDS) {
    commands[cmd.slash] = { template: cmd.template, description: cmd.description };
  }
  return commands;
}

/** The plugin `tool` map: each surface as an AI-callable tool returning its workflow guidance. */
export function toPluginTools(): Record<string, ToolDefinition> {
  const tools: Record<string, ToolDefinition> = {};
  for (const cmd of COMMANDS) {
    tools[`rqml_wf_${cmd.key}`] = {
      description: cmd.description,
      args: {},
      execute: async () => cmd.template,
    };
  }
  return tools;
}
