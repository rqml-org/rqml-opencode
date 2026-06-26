# Implementation Plan

Staged implementation plan for `rqml-opencode` (RQML-OPENCODE-001), framed for
coding agents. Each stage names its scope (requirement / test-case IDs), the
agent task, the files it touches, the spec inputs it needs, its key output, and
how to verify it. Stages are ordered so each builds only on earlier ones.

## Implementation assumptions

These frame every stage; they are implementation details (not ADR-worthy) and may
be confirmed at the start of Stage 1.

- **Package:** a single published npm package `@rqml/opencode` (scope-consistent
  with `@rqml/cli`, `@rqml/mcp`), referenced in `opencode.json`'s `plugin` array;
  also loadable as a local `.opencode/plugins/` file (`DEC-DISTRIBUTION-NPM`,
  ADR none — host-forced).
- **Language/build:** TypeScript against the `@opencode-ai/plugin` types
  (and `@opencode-ai/sdk` for the client surface), compiled to `dist/` with a
  default export of the `Plugin` factory.
- **Tests:** Node's built-in runner (`node --test`) over fixtures, matching the
  sibling plugins' `.test.mjs` style; integration steps assume the `rqml` CLI
  (`@rqml/cli`) and a built plugin are available.
- **Verdict source:** every `rqml` invocation goes through the injected Bun `$`
  shell; the plugin computes no RQML logic itself (`DEC-THIN-ADAPTER`, ADR none
  — carries over).

## Trace discipline (every stage)

At the end of each stage, before it is considered done:
1. Record `rqml link REQ-XXX <impl-file>` for each requirement implemented.
2. Record `rqml link REQ-XXX <test-file> --type verifiedBy` for each test added.
3. Run `rqml check` — it must exit 0 (the project's `standard` strictness) — and
   `rqml check --strictness strict` to watch coverage close.
4. Commit the drift baseline (`.rqml/baseline.json`) so changed-implementation
   drift is detected from then on.

---

## Stage 1 — Package scaffold and conformant plugin factory
- [ ] **Scope:** REQ-MANIFEST, REQ-PLUGIN-FACTORY, REQ-DISTRIBUTION; TC-MANIFEST
- [ ] **Agent task:** Create the npm package skeleton for an opencode plugin — `package.json` (name `@rqml/opencode`, ESM, default export, `@opencode-ai/plugin`/`@opencode-ai/sdk` deps, build + test scripts), `tsconfig.json`, and a plugin entry exporting an `async` `Plugin` factory that returns the documented `Hooks` object (initially empty) and constructs cleanly in any project, deferring all behavior to its hooks.
- [ ] **Touch files/modules:** `package.json`, `tsconfig.json`, `src/index.ts` (factory), `src/hooks/index.ts` (placeholder wiring), `.gitignore`, build config
- [ ] **Inputs needed:** `requirements` `PKG-PLUGIN`; `constraints` `CON-PLUGIN-FORMAT`, `CON-NODE`; `decisions` `DEC-PLUGIN-PROGRAMMATIC`, `DEC-DISTRIBUTION-NPM`; `entities` `ENT-PLUGIN`
- [ ] **Key output:** an installable, type-checked plugin package that opencode loads and that does nothing until a hook fires in a governed project
- [ ] **Verify:** package builds; `node --test` smoke imports the built factory and asserts it returns the expected hook keys and performs no `rqml` call on construction; loads as a local `.opencode/plugins/` file without error (TC-MANIFEST)

## Stage 2 — Adapter core: discovery, CLI bridge, fail-open, strictness
- [ ] **Scope:** REQ-DISCOVERY, REQ-DORMANT, REQ-THIN-ADAPTER, REQ-CLI-CONTRACT, REQ-STRICTNESS-RESPECT, REQ-HOOK-FAIL-OPEN; TC-DORMANT, TC-FAIL-OPEN, TC-PARITY
- [ ] **Agent task:** Build the thin adapter layer with no requirements logic: `findSpec` (walk the working directory and an edited file's directory up parent directories to the nearest `requirements.rqml` / sole `.rqml`, bounded by the repo root); `runRqml` (shell the CLI via `$`, map exit codes 0/1/2/64, parse the `status`/`check` JSON); `readStrictness` (nearest `AGENTS.md`, default `standard`); and a warn-once fail-open helper that never throws.
- [ ] **Touch files/modules:** `src/adapter/discover.ts`, `src/adapter/cli.ts`, `src/adapter/strictness.ts`, `src/adapter/failopen.ts`, `test/adapter.test.mjs`, `test/fixtures/`
- [ ] **Inputs needed:** `requirements` `PKG-PLUGIN` (REQ-DISCOVERY/DORMANT/THIN-ADAPTER), `PKG-CONFIG` (REQ-CLI-CONTRACT/STRICTNESS-RESPECT), `PKG-HOOKS` (REQ-HOOK-FAIL-OPEN); `domain` `ENT-MARKER`, `ENT-VERDICT`, `BR-EXIT-CONTRACT`, `BR-NEVER-BRICK`; `decisions` `DEC-THIN-ADAPTER`, `DEC-CLI-FOR-VERDICTS`, `DEC-FAIL-OPEN`
- [ ] **Key output:** a deterministic, fail-open bridge to the rqml CLI that every hook builds on, with no RQML parsing in plugin code
- [ ] **Verify:** unit tests for discovery (governed subdirectory resolves; no spec → dormant), exit-code mapping, strictness read, warn-once; TC-DORMANT, TC-FAIL-OPEN; TC-PARITY (hook verdict equals a bare `rqml check` on the same fixture)

## Stage 3 — Pre-edit gate and spec-edit validation (the hard lever) — ADR-0001
- [ ] **Scope:** REQ-HOOK-PREIMPL, REQ-PREIMPL-COVERAGE-DISCLOSURE, REQ-HOOK-SPEC-VALIDATE, REQ-HOOK-DIAGNOSTICS; TC-PREIMPL-DENY, TC-PREIMPL-FAILOPEN, TC-SPEC-EDIT, TC-SUBAGENT-GAP
- [ ] **Agent task:** Implement `tool.execute.before` to consult the toolchain approval-gate verdict and **throw** to deny an `edit`/`write` to code linked by an `implements` edge to a non-approved requirement (naming the requirement and the reproducing command), failing open on any CLI error. Implement `tool.execute.after` to run `rqml validate` on edits/writes to `.rqml` documents and mutate the tool result so diagnostics reach the agent in the same turn. Centralize verbatim-diagnostics formatting.
- [ ] **Touch files/modules:** `src/hooks/pre-edit.ts`, `src/hooks/spec-validate.ts`, `src/adapter/diagnostics.ts`, `test/pre-edit.test.mjs`, `test/spec-validate.test.mjs`, `test/fixtures/` (governed / drifted / non-approved)
- [ ] **Inputs needed:** `requirements` `PKG-HOOKS`; `domain` `ENT-HOOK`, `BR-SHOW-YOUR-WORK`, `BR-NEVER-BRICK`, `BR-NO-MODEL`; `decisions` `DEC-PRE-TOOL-GATE-CENTRAL`; **ADR-0001**; depends on the Stage 2 adapter
- [ ] **Key output:** the deterministic hard in-session gate at the edit boundary, plus same-turn spec-edit validation, with the subagent coverage boundary disclosed
- [ ] **Verify:** TC-PREIMPL-DENY (throws, names the requirement), TC-PREIMPL-FAILOPEN (no throw on CLI error, one warning), TC-SPEC-EDIT (duplicate-id diagnostic same turn), TC-SUBAGENT-GAP (disclosure text present in the surfaces)

## Stage 4 — Session anchor injection — ADR-0002, ADR-0003
- [ ] **Scope:** REQ-HOOK-ANCHOR, REQ-ENFORCEMENT-HONESTY (anchor half), REQ-EXPERIMENTAL-API-RISK (anchor half); TC-ANCHOR, TC-API-ABSENT (anchor path)
- [ ] **Agent task:** Implement the dynamic anchor: feature-detect `experimental.chat.system.transform` and push a compact, freshly computed `rqml status` (docId, coverage, drift), the five-stage loop reminder, and the honest advisory-enforcement note onto the system prompt; fall back to a `chat.message` text part, then to a static `instructions` file. Guard the experimental dependency so its absence degrades gracefully.
- [ ] **Touch files/modules:** `src/hooks/anchor.ts`, `src/adapter/feature-detect.ts`, `src/content/anchor.ts` (compact status + honesty note template), `test/anchor.test.mjs`
- [ ] **Inputs needed:** `requirements` `PKG-HOOKS` (REQ-HOOK-ANCHOR, REQ-ENFORCEMENT-HONESTY, REQ-EXPERIMENTAL-API-RISK); `goals` `GOAL-HONEST-POSTURE`; `decisions` `DEC-CONTEXT-INJECTION`, `DEC-SOFT-TURN-END`; **ADR-0002**, **ADR-0003**
- [ ] **Key output:** a dynamic, honest session anchor with graceful fallbacks where the host lacks the experimental hook
- [ ] **Verify:** TC-ANCHOR (context carries docId + coverage + loop reminder + advisory note); TC-API-ABSENT (anchor falls back to `chat.message`/instructions without crashing)

## Stage 5 — Advisory idle check and workspace fan-out — ADR-0002
- [ ] **Scope:** REQ-TURN-END-CHECK, REQ-HOOK-WORKSPACE, REQ-ENFORCEMENT-HONESTY (status half); TC-IDLE-ADVISORY, TC-IDLE-QUIET, TC-WORKSPACE
- [ ] **Agent task:** Implement the `event` hook on `session.idle` to run `rqml check` at the declared strictness and, on a non-zero verdict, surface verbatim diagnostics via `client.tui.showToast` and — only in long-lived interactive (TUI/server) sessions — an idempotent, loop-protected soft continuation via `client.session.prompt`; never block; the message names CI as authoritative. At a spec-less workspace root, run `rqml check --workspace` (CLI-driven discovery) with the same soft surface, staying silent when the CLI is absent.
- [ ] **Touch files/modules:** `src/hooks/idle-check.ts`, `src/adapter/workspace.ts`, `src/adapter/run-mode.ts` (interactive vs `opencode run`), `test/idle-check.test.mjs`
- [ ] **Inputs needed:** `requirements` `PKG-HOOKS` (REQ-TURN-END-CHECK, REQ-HOOK-WORKSPACE, REQ-ENFORCEMENT-HONESTY); `goals` `OBS-NO-HARD-GATE`; `domain` `BR-NO-FALSE-ASSURANCE`; `decisions` `DEC-SOFT-TURN-END`; **ADR-0002**
- [ ] **Key output:** the honest advisory turn-end safety net plus workspace fan-out, never blocking and never claiming to
- [ ] **Verify:** TC-IDLE-ADVISORY (diagnostics surfaced, turn not blocked, names CI); TC-IDLE-QUIET (silent on pass); TC-WORKSPACE (units listed at anchor + aggregated workspace diagnostics surfaced advisorily)

## Stage 6 — Command surfaces — ADR-0004
- [ ] **Scope:** REQ-COMMAND-SURFACES, REQ-CMD-INIT, REQ-CMD-STATUS, REQ-CMD-CHECK, REQ-CMD-DESIGN, REQ-CMD-PLAN, REQ-CMD-REVIEW, REQ-PATH-DISCIPLINE
- [ ] **Agent task:** Author the six command surfaces (init, status, check, design, plan, review) as config-injectable JSON command templates **and** as plugin-registered tools, each a thin wrapper over the rqml CLI / `@rqml/mcp` with no requirements logic. init scaffolds via `rqml init`, elicits first requirements, and guides adding the plugin to `opencode.json`; status re-anchors and reports the honest posture; check runs the gate and resolves findings; design writes an ADR; plan writes/updates `.rqml/plan.md`; review renders overview + matrix and approves. All guidance prefers path inputs and `rqml link` over inline XML.
- [ ] **Touch files/modules:** `src/commands/*.ts` (templates + tool definitions), `src/commands/index.ts`, `test/commands.test.mjs`
- [ ] **Inputs needed:** `requirements` `PKG-COMMANDS`, `PKG-AGENT-TOOLS` (REQ-PATH-DISCIPLINE); `decisions` `DEC-COMMAND-SURFACES`, `DEC-THIN-ADAPTER`; **ADR-0004**; upstream `RQML-SELF-001` (REQ-ADR-CONVENTION, REQ-PLAN-CONVENTION) for design/plan
- [ ] **Key output:** the six entry points available as both JSON commands and plugin tools, ready to be registered by Stage 8
- [ ] **Verify:** each surface is well-formed (template + tool); init/status/check/design/plan/review behave against fixtures (CRIT-CMD-DESIGN writes to `.rqml/adr/`, CRIT-CMD-PLAN writes `.rqml/plan.md`, CRIT-REVIEW-ACCEPT approves a confirmed requirement)

## Stage 7 — Vendored authoring craft and drift guard
- [ ] **Scope:** REQ-SKILL-AUTHORING, REQ-CRAFT-GUARD
- [ ] **Agent task:** Vendor rqml-skill's canonical `authoring.md` and `monorepo.md` (with the `canonical-version` stamp), add only thin activation pointers of the plugin's own, and add a CI drift guard that fails when a vendored copy diverges from its canonical source (skipping when the source is unreachable). Coordinate with rqml-skill's craft-sync so refresh PRs fan out here.
- [ ] **Touch files/modules:** `craft/authoring.md`, `craft/monorepo.md`, `src/content/craft.ts` (pointer), `scripts/check-craft-drift.mjs`, `test/craft-sync.test.mjs`
- [ ] **Inputs needed:** `requirements` `PKG-CRAFT`; `decisions` `DEC-VENDOR-CRAFT`; rqml-skill ADR-0009 (DEC-CRAFT-HOME); upstream `RQML-SKILL-001` (REQ-AUTHORING-CRAFT, REQ-CRAFT-SYNC)
- [ ] **Key output:** offline, in-context authoring craft kept current by the upstream sync, guarded against drift
- [ ] **Verify:** CRIT-CRAFT-GUARD (edited vendored copy fails the guard; unreachable source skips it); the vendored files match the canonical stamp

## Stage 8 — Config-hook registration: MCP, commands, instructions — ADR-0003
- [ ] **Scope:** REQ-CONFIG-HOOK-REGISTER, REQ-MCP-BUNDLED, REQ-EXPERIMENTAL-API-RISK (registration half), REQ-NO-RESIDUE, REQ-INSTALL-SMOKE; TC-CONFIG-REGISTER, TC-API-ABSENT (registration path)
- [ ] **Agent task:** Implement the `config` hook to register, by feature-detected in-place mutation, the `@rqml/mcp` server (`config.mcp.rqml = {type:"local", command:["npx","-y","@rqml/mcp"]}`), the Stage 6 command surfaces (`config.command`), and the Stage 7 craft as instruction files (`config.instructions`). Provide a documented `opencode.json` fallback for each contribution; ensure contributions are in-memory only (no on-disk residue). Add the installed-layout smoke test that proves the built package registers its contributions.
- [ ] **Touch files/modules:** `src/hooks/config.ts`, `src/adapter/register.ts`, `test/config-register.test.mjs`, `test/install-smoke.test.mjs`
- [ ] **Inputs needed:** `requirements` `PKG-AGENT-TOOLS` (REQ-MCP-BUNDLED, REQ-CONFIG-HOOK-REGISTER), `PKG-PLUGIN` (REQ-NO-RESIDUE, REQ-INSTALL-SMOKE), `PKG-HOOKS` (REQ-EXPERIMENTAL-API-RISK); `domain` `ENT-REGISTRATION`; `decisions` `DEC-CONFIG-HOOK-REGISTER`; **ADR-0003**; depends on Stages 6 and 7
- [ ] **Key output:** one-line install where the host honors the config hook, with a documented manual fallback otherwise, proven by the install smoke test
- [ ] **Verify:** TC-CONFIG-REGISTER (resolved config gains the MCP server, commands, and instructions); TC-API-ABSENT (manual fallback, one-time note, no crash); REQ-INSTALL-SMOKE (installed layout registers and the `rqml_*` tools are available)

## Stage 9 — CI gate and adoption documentation
- [ ] **Scope:** REQ-CI-PARITY, REQ-DOCS-CONVERSION, REQ-DOCS-ONBOARDING, REQ-DOCS-SURFACES; TC-DOCS
- [ ] **Agent task:** Add the CI workflow that runs the test suite, `rqml check`, `rqml check --strictness strict`, and the craft drift guard on every PR and main-branch push. Write the README and concept/onboarding/troubleshooting docs: what RQML is and why it matters for opencode work; install (the `plugin` array, AGENTS.md strictness) to first passing gate; and an **honest** description of enforcement — hard pre-edit gate, advisory turn-end check, subagent coverage gap, CI authoritative, feature-detected registration. Add a docs-validation test for broken links and the honesty claims.
- [ ] **Touch files/modules:** `.github/workflows/ci.yml`, `README.md`, `docs/why-rqml-opencode.md`, `docs/quickstart.md`, `docs/troubleshooting.md`, `test/docs-validation.test.mjs`
- [ ] **Inputs needed:** `requirements` `PKG-DOCS`, `PKG-PLUGIN` (REQ-CI-PARITY); `goals` `GOAL-PARITY`, `GOAL-HONEST-POSTURE`; ADR-0001, ADR-0002 (for the honesty narrative)
- [ ] **Key output:** an authoritative CI gate and benefit-led, honest documentation from install to first green check
- [ ] **Verify:** CI fails when tests / `rqml check` / strict check fail; TC-DOCS (README explains RQML + the opencode plugin, gives a first-green-check path, and describes enforcement honestly — pre-edit hard, turn-end advisory, CI authoritative)

---

## Readiness Verdict
**READY to implement** — the spec (RQML-OPENCODE-001, 36 approved requirements)
and the four ADRs are accepted; the staging above covers every requirement and
test case with dependencies ordered.

### Pre-flight confirmations (non-blocking, resolve at Stage 1)
- [ ] Confirm the npm package name `@rqml/opencode` and the `@opencode-ai/plugin`
      / `@opencode-ai/sdk` version range to target.
- [ ] Confirm the build/test toolchain (TypeScript → `dist/`, `node --test`) and
      whether to also ship loadable TS for the local `.opencode/plugins/` form.
- [ ] Confirm the rqml CLI version range to declare (`REQ-CLI-CONTRACT`).

### Watch items (tracked in governance, do not block Stage 1)
- [ ] `ISS-V2-PLUGIN-API` — if opencode's v2 registration API stabilizes during
      implementation, prefer it over the config-hook mutation (revisits ADR-0003,
      ADR-0004; affects Stages 6 and 8).
- [ ] `ISS-UPSTREAM-GATE` — if `session.stopping` (#16626) or `event.sync`
      (#16879) merges, the advisory idle check (Stage 5) can be upgraded toward a
      hard block (revisits ADR-0002).
- [ ] The pre-edit gate and config-hook registration depend on opencode behaviors
      confirmed from the plugin type definitions; validate them against a live
      opencode build early in Stages 3 and 8.
