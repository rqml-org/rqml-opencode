/**
 * Zero-touch registration — REQ-CONFIG-HOOK-REGISTER, REQ-MCP-BUNDLED,
 * REQ-NO-RESIDUE, DEC-CONFIG-HOOK-REGISTER, ADR-0003.
 *
 * Contributes the @rqml/mcp server, the command surfaces, and the vendored craft
 * (as instruction files) into the resolved opencode config by non-destructive
 * in-place mutation — an existing user entry is never clobbered. The mutation is
 * in-memory only: nothing is written to disk, so removing the plugin removes its
 * contributions (REQ-NO-RESIDUE).
 */
import { CRAFT_FILES } from "../content/craft.ts";
import { toConfigCommands } from "../commands/index.ts";

/** The bundled MCP server registration — REQ-MCP-BUNDLED. */
export const RQML_MCP = { type: "local" as const, command: ["npx", "-y", "@rqml/mcp"], enabled: true };

/** The slice of the opencode config the plugin mutates. */
export interface RegisterableConfig {
  mcp?: Record<string, unknown>;
  command?: Record<string, unknown>;
  instructions?: string[];
}

/** What a registration newly added (used by the smoke test). */
export interface Registered {
  mcp: boolean;
  commands: string[];
  instructions: string[];
}

/**
 * Register the plugin's contributions. `opts.craft` (default true) gates the
 * eager craft instructions — the config hook turns it off outside an
 * RQML-governed project so non-RQML sessions are not loaded with the craft.
 */
export function registerContributions(cfg: RegisterableConfig, opts: { craft?: boolean } = {}): Registered {
  const added: Registered = { mcp: false, commands: [], instructions: [] };

  const mcp = (cfg.mcp ??= {});
  if (!("rqml" in mcp)) {
    mcp.rqml = { ...RQML_MCP };
    added.mcp = true;
  }

  const command = (cfg.command ??= {});
  for (const [name, def] of Object.entries(toConfigCommands())) {
    if (!(name in command)) {
      command[name] = def;
      added.commands.push(name);
    }
  }

  if (opts.craft !== false) {
    const instructions = (cfg.instructions ??= []);
    for (const file of CRAFT_FILES) {
      if (!instructions.includes(file)) {
        instructions.push(file);
        added.instructions.push(file);
      }
    }
  }

  return added;
}
