/**
 * Pre-edit approval gate — REQ-HOOK-PREIMPL, ADR-0001.
 *
 * opencode's tool.execute.before is awaited and aborts the tool call when it
 * throws — the one hard, synchronous, deterministic in-session lever the host
 * offers. Before an edit or write to code already linked by an implements edge
 * to a non-approved requirement, this hook consults the toolchain's approval
 * verdict (`rqml gate`, exit 2 = blocked) and throws to deny it. The verdict is
 * the CLI's, never the model's (BR-NO-MODEL); any CLI error fails open so a
 * missing or broken toolchain never bricks an edit (BR-NEVER-BRICK).
 *
 * Coverage boundary: this fires for the main agent's edit/write calls, not for
 * edits made inside subagents spawned via the task tool
 * (REQ-PREIMPL-COVERAGE-DISCLOSURE, opencode #5894). CI is the backstop.
 */
import { isAbsolute, relative, resolve } from "node:path";
import type { Hooks } from "@opencode-ai/plugin";

import { findSpecForFile, runRqml } from "../adapter/index.ts";
import { formatDiagnostics } from "../adapter/diagnostics.ts";
import { MISSING_CLI_MESSAGE } from "../content/messages.ts";
import type { HookContext } from "./context.ts";

type ToolExecuteBefore = NonNullable<Hooks["tool.execute.before"]>;

const EDIT_TOOLS = new Set(["edit", "write"]);

export function preEditGate(ctx: HookContext): ToolExecuteBefore {
  return async (input, output) => {
    if (!EDIT_TOOLS.has(input.tool)) return;

    const raw: unknown = output.args?.filePath;
    if (typeof raw !== "string" || raw.length === 0) return;

    const abs = isAbsolute(raw) ? raw : resolve(ctx.directory, raw);
    const loc = findSpecForFile(abs);
    if (!loc) return; // ungoverned -> dormant (REQ-DORMANT)

    const rel = relative(loc.specDir, abs) || abs;
    const result = await runRqml(ctx.$, ["gate", rel, "--base-dir", loc.specDir], { cwd: loc.specDir });

    if (!result.available) {
      ctx.warnOnce("rqml-missing", () => ctx.notify(MISSING_CLI_MESSAGE));
      return; // fail open (REQ-HOOK-FAIL-OPEN)
    }
    // Only a clear gate-block verdict (exit 2) denies; everything else allows.
    if (result.verdict !== "blocking") return;

    throw new Error(
      formatDiagnostics(
        `approval gate — \`${rel}\` implements a requirement that is not approved`,
        result,
        `rqml gate ${rel}`,
      ),
    );
  };
}
