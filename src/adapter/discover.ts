/**
 * Governing-spec discovery — REQ-DISCOVERY, REQ-DORMANT.
 *
 * Resolves the spec that governs a directory (or an edited file) by walking the
 * working directory and then each successive parent directory up to the
 * repository root, returning the nearest enclosing spec. When none is found the
 * project is ungoverned and every hook stays dormant. The plugin parses no RQML
 * here — it only locates the document the CLI will read (REQ-THIN-ADAPTER).
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface SpecLocation {
  /** Absolute path to the governing spec document. */
  specPath: string;
  /** Absolute path to the directory the spec governs. */
  specDir: string;
}

const SPEC_NAME = "requirements.rqml";

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * The spec document in `dir`, or null. `requirements.rqml` wins; otherwise a
 * sole `*.rqml` file is the spec. A directory named `.rqml` (the metadata
 * directory) is never a spec, and several `*.rqml` files with no
 * `requirements.rqml` are ambiguous — treated as no spec in this directory.
 */
function specInDir(dir: string): string | null {
  const canonical = join(dir, SPEC_NAME);
  if (isFile(canonical)) return canonical;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }

  let sole: string | null = null;
  for (const name of entries) {
    if (name === ".rqml" || !name.endsWith(".rqml")) continue;
    const full = join(dir, name);
    if (!isFile(full)) continue;
    if (sole) return null; // ambiguous: multiple *.rqml, no requirements.rqml
    sole = full;
  }
  return sole;
}

/**
 * Resolve the governing spec for `startDir` by walking up to the repository
 * root (a directory containing `.git`) or the filesystem root. Returns the
 * nearest enclosing spec (REQ-DISCOVERY) or null when the project is ungoverned
 * (REQ-DORMANT).
 */
export function findSpec(startDir: string): SpecLocation | null {
  let dir = resolve(startDir);
  for (;;) {
    const specPath = specInDir(dir);
    if (specPath) return { specPath, specDir: dir };

    const atRepoRoot = existsSync(join(dir, ".git"));
    const parent = dirname(dir);
    if (atRepoRoot || parent === dir) return null;
    dir = parent;
  }
}

/** Resolve the governing spec for a file, using the file's own directory. */
export function findSpecForFile(filePath: string): SpecLocation | null {
  return findSpec(dirname(resolve(filePath)));
}
