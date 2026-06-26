/**
 * The shared per-session context every hook is built from — assembled once in
 * createHooks and closed over by each handler.
 */
import type { Shell, WarnOnce } from "../adapter/index.ts";

export interface HookContext {
  /** The injected Bun shell, used only to run the rqml CLI (REQ-THIN-ADAPTER). */
  $: Shell;
  /** The session's working directory, for resolving relative edit paths. */
  directory: string;
  /** Per-session fail-open gate so any one warning is shown at most once. */
  warnOnce: WarnOnce;
  /** Surface a one-line notice (console for now; a TUI toast in Stage 5). */
  notify: (message: string) => void;
}
