/**
 * Tolerating semi-internal / experimental host capabilities — REQ-EXPERIMENTAL-API-RISK.
 *
 * The anchor (experimental.chat.system.transform) and zero-touch registration
 * (the config hook) build on opencode capabilities that are not in the public
 * docs or are experimental. `guarded` wraps such a hook body so that if the
 * capability's shape has changed and the body throws, the error is contained
 * and surfaced once instead of crashing the session — the plugin degrades to its
 * documented fallbacks (and CI) rather than breaking.
 */

/** Wrap an async hook body so a thrown error is contained and reported, never rethrown. */
export function guarded<A extends unknown[]>(
  fn: (...args: A) => Promise<void>,
  onError: (err: unknown) => void,
): (...args: A) => Promise<void> {
  return async (...args: A): Promise<void> => {
    try {
      await fn(...args);
    } catch (err) {
      onError(err);
    }
  };
}
