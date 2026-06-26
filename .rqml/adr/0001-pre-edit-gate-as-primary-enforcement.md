# ADR-0001: Center in-session enforcement on the tool boundary, since opencode cannot gate turn-end

- Status: Accepted
- Date: 2026-06-26
- Classification: discretionary_design_choice
- Decision ID (in `requirements.rqml`): `DEC-PRE-TOOL-GATE-CENTRAL`
- Related requirements: `REQ-HOOK-PREIMPL`, `REQ-PREIMPL-COVERAGE-DISCLOSURE`, `REQ-HOOK-SPEC-VALIDATE`, `REQ-HOOK-DIAGNOSTICS`
- Related ADRs: ADR-0002 (advisory turn-end check); rqml ADR-0008 (approval-before-implementation gate); rqml ADR-0001 (spec-enforcement control loop)
- Affected components: rqml-opencode (`tool.execute.before` and `tool.execute.after` hooks)

## Context

The sibling plugins (rqml-claude, rqml-codex) put the hard enforcement point at
**session/turn end**: a `Stop` hook (exit 2) or a `decision:"block"` continuation
runs `rqml check` and refuses to let the turn finish on a non-zero verdict. That
shape is unavailable on opencode.

Verified against the `@opencode-ai/plugin` type definitions and the sst/opencode
core source: opencode exposes **no hook that can prevent a turn or session from
ending**. `session.idle` is delivered through the generic `event` hook, which is
dispatched fire-and-forget (its returned promise is discarded and exceptions are
swallowed) and fires only after the agent loop has already broken
(`CON-NO-STOP-GATE`; upstream feature requests sst/opencode #16626 and #16879
remain unmerged).

What opencode *does* offer is a hard, synchronous block at the **tool boundary**:
`tool.execute.before(input, output)` is awaited, and **throwing** aborts the tool
call before it runs. The call is scoped by `output.args.filePath`, so a hook can
deny a specific edit. The approval-before-implementation judgement this needs
already exists in the engine as a deterministic verdict (rqml ADR-0008,
`REQ-CORE-APPROVAL-VERDICT`). One coverage fact matters: `tool.execute.before`
does **not** intercept edits made by subagents spawned through the task tool
(sst/opencode #5894).

## Decision drivers

- Determinism; no language model in the verdict path (`CON-DETERMINISTIC`).
- Enforce at the change, not at session end — and on this host, session end
  cannot enforce at all.
- Reuse the existing approval verdict (rqml ADR-0008) rather than reinvent it.
- Fail open: a missing or hung toolchain must never brick an edit
  (`BR-NEVER-BRICK`).
- Never oversell coverage the host cannot deliver (`BR-NO-FALSE-ASSURANCE`).

## Options considered

### Option 1: Advisory only everywhere

Use `permission.ask` ("ask"/warn) or messaging for edits to non-approved-
requirement code, never hard-denying.

**Pros**
- Uniform behavior across the main loop and subagent edits (no "blocked here,
  allowed there" inconsistency).
- Never surprises the agent with a hard denial.

**Cons**
- Discards the one hard, deterministic, synchronous in-session lever opencode
  actually provides. On a host that already cannot gate turn-end, this leaves
  *no* hard in-session enforcement at all.

### Option 2: Hard pre-edit block at the tool boundary (chosen)

`tool.execute.before` consults the toolchain approval verdict and **throws** to
deny an edit/write to code already linked by an `implements` edge to a non-
approved requirement; it fails open on any CLI error. The subagent coverage gap
is disclosed. `tool.execute.after` carries the in-turn `.rqml` validate feedback.

**Pros**
- A real, deterministic hard gate fires *at the edit* — earlier than the
  siblings' end-of-turn gate.
- Reuses one shared engine verdict (editor, agent, CI agree).
- The `.rqml` validate loop rides the same tool-boundary wiring.

**Cons**
- Only bites code that already has an `implements` edge; net-new, not-yet-linked
  code escapes a trace-based gate (governed by the advisory idle check and CI).
- Subagent/task-tool edits are not intercepted (#5894), so coverage is partial
  and must be disclosed.
- The plugin becomes the only place that throws, so the fail-open guard around
  it is load-bearing.

### Option 3: Wait for an upstream turn-end gate

Keep enforcement at session end like the siblings and adopt a hard gate once
opencode ships `session.stopping` (#16626).

**Pros**
- Mechanism parity with the siblings if/when it lands.

**Cons**
- The feature is unmerged with no committed timeline; this would ship *no*
  in-session enforcement in the meantime. Deferred to `ISS-UPSTREAM-GATE`.

## Decision

Adopt **Option 2**. The pre-edit gate (`REQ-HOOK-PREIMPL`) is the primary
synchronous enforcement point: `tool.execute.before` denies, by throwing, an edit
to code linked to a non-approved requirement, consulting the toolchain's
deterministic approval verdict and failing open on any CLI error. Spec-edit
validation (`REQ-HOOK-SPEC-VALIDATE`) rides `tool.execute.after`, mutating the
tool result so diagnostics reach the agent in the same turn. The subagent
coverage boundary (#5894) is disclosed in the anchor, the status surface, and the
docs (`REQ-PREIMPL-COVERAGE-DISCLOSURE`), with CI as the backstop for that path
(ADR-0002).

## Consequences

### Positive

- A deterministic hard gate operates in-session, earlier than the siblings', over
  one shared verdict.
- The stable `rqml check`/CI contract is undisturbed.
- The spec-edit validation loop reuses the same tool-boundary hooks.

### Negative

- The trace-based gate only bites code with an existing `implements` edge;
  first-write coverage stays with the advisory idle check and CI, and must be
  documented or the gate feels arbitrary.
- Subagent/task-tool edits are not intercepted (#5894) — partial coverage that
  must be disclosed, not hidden.
- The throw path concentrates the only hard-failure risk in the plugin, so its
  fail-open guards are critical.

## Supersession

None. Revisit if opencode closes #5894 (per-subagent tool interception), which
would extend the gate's coverage without changing this decision's shape.
