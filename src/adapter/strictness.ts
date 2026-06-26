/**
 * Declared-strictness resolution — REQ-STRICTNESS-RESPECT.
 *
 * Reads the strictness the project declares in the nearest AGENTS.md (the
 * convention opencode loads natively), walking up to the repository root and
 * defaulting to `standard`. The plugin runs every gate at this level so what it
 * surfaces locally matches what CI enforces (GOAL-PARITY).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export type Strictness = "relaxed" | "standard" | "strict" | "certified";

const DEFAULT_STRICTNESS: Strictness = "standard";
const LEVELS: readonly Strictness[] = ["relaxed", "standard", "strict", "certified"];

/** Matches the `## Strictness: \`<level>\`` heading convention in AGENTS.md. */
const STRICTNESS_RE = /^\s{0,3}#{1,6}\s*Strictness:\s*`?([A-Za-z]+)`?/m;

function parseStrictness(markdown: string): Strictness | null {
  const match = STRICTNESS_RE.exec(markdown);
  if (!match) return null;
  const level = match[1].toLowerCase();
  return (LEVELS as readonly string[]).includes(level) ? (level as Strictness) : null;
}

/**
 * The strictness declared in the nearest AGENTS.md at or above `fromDir`, or
 * `standard` when none declares one (REQ-STRICTNESS-RESPECT).
 */
export function readStrictness(fromDir: string): Strictness {
  let dir = resolve(fromDir);
  for (;;) {
    const agents = join(dir, "AGENTS.md");
    if (existsSync(agents)) {
      let level: Strictness | null = null;
      try {
        level = parseStrictness(readFileSync(agents, "utf8"));
      } catch {
        level = null;
      }
      if (level) return level;
    }

    const atRepoRoot = existsSync(join(dir, ".git"));
    const parent = dirname(dir);
    if (atRepoRoot || parent === dir) break;
    dir = parent;
  }
  return DEFAULT_STRICTNESS;
}
