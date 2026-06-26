/**
 * The shared per-session context every hook is built from — assembled once in
 * createHooks and closed over by each handler.
 */
import type { Shell, WarnOnce } from "../adapter/index.ts";

/** The minimal slice of the opencode SDK client the plugin uses (toasts, prompts). */
export interface PluginClient {
  tui: {
    showToast(opts: {
      body: { message: string; variant?: string; title?: string };
    }): Promise<boolean | undefined> | boolean | undefined;
  };
  session: {
    prompt(opts: {
      path: { id: string };
      body: { parts: Array<{ type: string; text: string }>; noReply?: boolean };
    }): Promise<unknown>;
  };
}

export interface HookContext {
  /** The injected Bun shell, used only to run the rqml CLI (REQ-THIN-ADAPTER). */
  $: Shell;
  /** The session's working directory, for resolving relative edit paths. */
  directory: string;
  /** The opencode SDK client, for toasts and the soft continuation prompt. */
  client: PluginClient;
  /** Per-session fail-open gate so any one warning is shown at most once. */
  warnOnce: WarnOnce;
  /** Surface a one-line notice (console / headless logs; a TUI toast is preferred). */
  notify: (message: string) => void;
}
