/**
 * rqml-opencode — RQML spec-first enforcement for opencode.
 *
 * The package's default export is a conformant opencode `Plugin` factory
 * (RQML-OPENCODE-001 REQ-MANIFEST, REQ-PLUGIN-FACTORY). The factory consumes
 * only the documented plugin input and defers every RQML behavior to its
 * hooks, so it constructs cleanly in any project and does nothing until a hook
 * fires in a governed project (REQ-DORMANT). Every rqml invocation a hook makes
 * goes through the injected Bun `$` shell — the plugin computes no requirements
 * logic itself (REQ-THIN-ADAPTER, DEC-THIN-ADAPTER).
 *
 * Stage 1 wires the package and the factory only; the hooks themselves
 * (pre-edit gate, spec-edit validation, anchor, idle check, config
 * registration) land in later stages — see .rqml/plan.md.
 */
import type { Plugin } from "@opencode-ai/plugin";

import { createHooks } from "./hooks/index.ts";

/**
 * The opencode plugin factory. opencode calls this once per load with the
 * plugin input ({ client, project, directory, worktree, $, ... }); it returns
 * the Hooks object opencode drives the session with.
 */
const RqmlPlugin: Plugin = async (input) => createHooks(input);

export default RqmlPlugin;
export { RqmlPlugin };
