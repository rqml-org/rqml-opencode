# ADR-0002: Make the turn-end check advisory, with CI as the authoritative gate

- Status: Accepted
- Date: 2026-06-26
- Classification: discretionary_design_choice
- Decision ID (in `requirements.rqml`): `DEC-SOFT-TURN-END`
- Related requirements: `REQ-TURN-END-CHECK`, `REQ-ENFORCEMENT-HONESTY`, `REQ-CI-PARITY`, `REQ-HOOK-WORKSPACE`
- Related ADRs: ADR-0001 (pre-edit gate as primary enforcement); rqml ADR-0001 (spec-enforcement control loop); rqml ADR-0003 (deterministic checking)
- Affected components: rqml-opencode (`event` hook on `session.idle`; SDK client; CI workflow; anchor and status messaging)

## Context

The siblings' defining feature is a hard stop gate: the turn cannot end while
`rqml check` is non-zero. opencode cannot block turn-end (`CON-NO-STOP-GATE`,
ADR-0001). `session.idle` is observed *after* the agent loop has already broken,
and its `event` hook is fire-and-forget.

The SDK `client` available to the plugin can inject a follow-up prompt
(`client.session.prompt(...)`), which is a **soft, model-in-the-loop
continuation** — a new turn, not a re-entry of the ended one — and is known to be
racy against process teardown in the non-interactive `opencode run` mode
(sst/opencode #16626/#16879). So the open question is not *whether* the turn-end
check can block (it cannot) but *how it should behave* given that it cannot.

## Decision drivers

- Honesty over the appearance of protection: the worst failure mode on this host
  is the team believing the turn was gated when it was not
  (`BR-NO-FALSE-ASSURANCE`, `RISK-FALSE-ASSURANCE`).
- Keep the in-session nudge to finish the loop where it can be delivered safely.
- Robustness in headless `opencode run` (no synthetic-message races).
- Preserve local/CI parity with CI as the authoritative boundary
  (`GOAL-PARITY`).

## Options considered

### Option 1: Aggressive soft continuation everywhere

On any failing idle check, always inject `client.session.prompt(diagnostics)` to
re-engage the model, mimicking the sibling "you can't stop yet" feel.

**Pros**
- Closest in-session *feel* to the siblings.

**Cons**
- Racy and unreliable in `opencode run` (re-prompts race teardown, can create
  empty continuation turns).
- Model-defeatable, and it clutters the transcript with synthetic user messages.

### Option 2: Observe-only

Run the idle check and only log/toast the result; never re-prompt.

**Pros**
- Maximally honest and robust.

**Cons**
- Gives up the in-session nudge entirely, even where it could be delivered
  safely.

### Option 3: Honest soft gate (chosen)

On `session.idle`, run `rqml check` at the project's strictness. On a non-zero
verdict, surface the diagnostics as a **toast always**, plus an **optional soft
continuation prompt only in long-lived TUI/server sessions** (skipped in
`opencode run`). Never block, never describe it as a hard gate; the surfaced
message names CI as the gate that enforces the same verdict.

**Pros**
- Honest posture by construction; works in headless mode (toast/log, no race).
- Keeps the in-session nudge where delivery is safe.
- CI guarantees the verdict at merge.

**Cons**
- In-session turn-end enforcement is advisory — a determined agent can end a turn
  red.
- The product promise diverges from the siblings and must be communicated
  plainly.

## Decision

Adopt **Option 3**. `REQ-TURN-END-CHECK`: at idle, run `rqml check` at the
declared strictness; on non-zero, surface verbatim diagnostics via toast and, in
interactive (TUI/server) sessions only, an idempotent, loop-protected soft
continuation; never block. CI (`REQ-CI-PARITY`) is the authoritative enforcement
boundary and the backstop for both the missing turn-end gate and the pre-edit
gate's subagent blind spot (ADR-0001). The anchor, the status surface, and the
docs state this posture openly (`REQ-ENFORCEMENT-HONESTY`). Workspace fan-out
(`REQ-HOOK-WORKSPACE`) inherits the same soft-only behavior at a spec-less root.

This is a deliberate, stated divergence from the siblings — the product promise
becomes "a hard pre-edit gate plus fast in-session feedback, with CI as the
authoritative gate," not "the turn cannot end on a failing check." It generalizes
rqml-codex's honest-status requirement (`REQ-TRUST-TRANSPARENCY`) from optional to
central.

## Consequences

### Positive

- The plugin never misrepresents what it enforces; "installed" and "hard-
  enforcing" are not conflated.
- Behavior is robust in headless mode; CI is the deterministic guarantee.
- In-session feedback is preserved where it can be delivered without races.

### Negative

- In-session turn-end enforcement is advisory only (compensated by the pre-edit
  hard gate and CI).
- The divergence from the siblings is a real difference in promise that
  documentation and messaging must carry.
- The soft continuation needs idempotency/loop-protection to avoid re-prompt
  spam.

## Supersession

None. If opencode merges a blocking turn-end gate (`session.stopping`, #16626) or
awaited event handlers (`event.sync`, #16879), revisit to upgrade the advisory
idle check toward a hard block while keeping the honest posture as the default
(`ISS-UPSTREAM-GATE`).
