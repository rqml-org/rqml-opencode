/**
 * Immediate spec-edit validation — REQ-HOOK-SPEC-VALIDATE, REQ-HOOK-DIAGNOSTICS.
 *
 * opencode's tool.execute.after cannot undo a completed edit, but it can rewrite
 * the tool result the model sees. After an edit or write to an .rqml document
 * this hook runs `rqml validate` and, when validation fails, appends the
 * diagnostics to the tool output so the agent repairs the document in the same
 * turn rather than persisting an invalid spec unnoticed. Fails open if the CLI
 * is unavailable (BR-NEVER-BRICK).
 */
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { Hooks } from "@opencode-ai/plugin";

import { runRqml } from "../adapter/index.ts";
import { formatDiagnostics } from "../adapter/diagnostics.ts";
import { MISSING_CLI_MESSAGE } from "../content/messages.ts";
import type { HookContext } from "./context.ts";

type ToolExecuteAfter = NonNullable<Hooks["tool.execute.after"]>;

const EDIT_TOOLS = new Set(["edit", "write"]);

export function specEditValidate(ctx: HookContext): ToolExecuteAfter {
  return async (input, output) => {
    if (!EDIT_TOOLS.has(input.tool)) return;

    const raw: unknown = input.args?.filePath;
    if (typeof raw !== "string" || !raw.endsWith(".rqml")) return;

    const abs = isAbsolute(raw) ? raw : resolve(ctx.directory, raw);
    const result = await runRqml(ctx.$, ["validate", abs], { cwd: dirname(abs) });

    if (!result.available) {
      ctx.warnOnce("rqml-missing", () => ctx.notify(MISSING_CLI_MESSAGE));
      return; // fail open
    }
    if (result.verdict === "pass") return; // valid document, nothing to surface

    const rel = relative(ctx.directory, abs) || abs;
    const banner = formatDiagnostics(
      "spec validation failed — fix before continuing",
      result,
      `rqml validate ${rel}`,
    );
    output.output = output.output ? `${output.output}\n\n${banner}` : banner;
  };
}
