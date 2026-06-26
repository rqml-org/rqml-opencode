/**
 * Craft drift guard — REQ-CRAFT-GUARD.
 *
 * Fails (exit 1) when a vendored craft/*.md has drifted from its canonical
 * rqml-skill source; skips (exit 0) when the source is unreachable, so a
 * network-less run is not a spurious failure. Run in CI on pull requests (the
 * sync PR validates itself; main is not gated on the moving upstream craft).
 * Do not edit craft/*.md locally — change them upstream and let craft-sync
 * propagate.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { CANONICAL_BASE, CRAFT_REFS, checkDrift } from "../src/content/craft.ts";

let drifted = false;

for (const name of CRAFT_REFS) {
  const vendored = readFileSync(fileURLToPath(new URL(`../craft/${name}`, import.meta.url)), "utf8");

  let canonical: string | null = null;
  try {
    const res = await fetch(`${CANONICAL_BASE}/${name}`, { signal: AbortSignal.timeout(10_000) });
    if (res.ok) canonical = await res.text();
  } catch {
    canonical = null;
  }

  switch (checkDrift(vendored, canonical)) {
    case "drifted":
      console.error(`✗ craft/${name} has drifted from rqml-skill references/${name}. Change it upstream and let craft-sync propagate.`);
      drifted = true;
      break;
    case "skipped":
      console.warn(`• craft/${name}: canonical source unreachable; drift check skipped.`);
      break;
    default:
      console.log(`✓ craft/${name} matches the canonical rqml-skill source.`);
  }
}

process.exit(drifted ? 1 : 0);
