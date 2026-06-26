/**
 * Fail-open warn-once gate — REQ-HOOK-FAIL-OPEN.
 *
 * The plugin must never nag. When the toolchain is missing or a host capability
 * is absent, it surfaces a single notice per distinct reason and otherwise stays
 * silent. `emit` is the actual surfacing (a toast, a log) supplied by the
 * caller, so this helper stays free of any host dependency.
 */
export interface WarnOnce {
  /** Emit `emit()` only the first time `key` is seen. Returns whether it fired. */
  (key: string, emit: () => void): boolean;
}

/** Create a per-session warn-once gate (one per plugin instance). */
export function createWarnOnce(): WarnOnce {
  const seen = new Set<string>();
  return (key, emit) => {
    if (seen.has(key)) return false;
    seen.add(key);
    emit();
    return true;
  };
}
