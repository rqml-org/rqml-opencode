/**
 * Config hook — REQ-CONFIG-HOOK-REGISTER, REQ-MCP-BUNDLED, REQ-EXPERIMENTAL-API-RISK,
 * ADR-0003.
 *
 * opencode passes the resolved config to this hook by reference; mutating it
 * registers the plugin's contributions with no opencode.json edit by the
 * developer. The config hook is semi-internal, so the body is guarded: if its
 * shape has changed and the mutation throws, the plugin degrades to the
 * documented manual setup (warned once) rather than crashing config resolution.
 * The eager craft instructions are added only inside a governed project.
 */
import type { Hooks } from "@opencode-ai/plugin";

import { findSpec, guarded } from "../adapter/index.ts";
import { registerContributions, type RegisterableConfig } from "../adapter/register.ts";
import type { HookContext } from "./context.ts";

type ConfigHook = NonNullable<Hooks["config"]>;
type ConfigInput = Parameters<ConfigHook>[0];

const DEGRADED =
  "RQML zero-touch registration is unavailable on this opencode build; add the @rqml/mcp server " +
  "(and the craft instruction files) to opencode.json manually — see the README.";

export function createConfigHook(ctx: HookContext): ConfigHook {
  return guarded(
    async (cfg: ConfigInput) => {
      registerContributions(cfg as unknown as RegisterableConfig, { craft: Boolean(findSpec(ctx.directory)) });
    },
    () => ctx.warnOnce("config-degraded", () => ctx.notify(DEGRADED)),
  );
}
