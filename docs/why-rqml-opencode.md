# Why rqml-opencode

## The problem it solves

opencode can write a lot of code quickly. What it cannot do reliably is hold the
*whole* of your intent — product boundaries, edge cases, non-functional
requirements, and the decisions made three sessions ago — in a single prompt.
Context windows rotate; a chat thread fades. The result is code that looks right
and quietly diverges from what the team actually agreed to build.

RQML makes the intent a **durable, structured artifact** instead of a fading
conversation. A `requirements.rqml` document holds goals, scenarios, testable
requirements, verification, and trace links. The agent reads it for context; the
team reads `rqml check` for a deterministic answer to "does the code still match
the spec?"

## What RQML gives an agent host

- **Explicit requirements as the durable artifact** — not a transcript, a spec
  in version control.
- **Structured context** — the agent is anchored on the spec id, coverage, and
  drift at the start of work.
- **Traceability** — code and tests are linked back to the requirements they
  implement and verify, with `rqml link`.
- **A deterministic drift gate** — `rqml check` validates the spec and fails on
  coverage gaps or drift. No model sits in the verdict path, so the local and CI
  verdicts cannot disagree.

## What this plugin promises on opencode

`rqml-opencode` is a thin adapter: it owns no requirements logic of its own and
relays every verdict from the `rqml` CLI. On opencode specifically:

- It **anchors** each session on a freshly computed `rqml status`.
- It **hard-blocks**, at the tool boundary, an edit to code that implements a
  requirement you have not approved — opencode's strongest in-session lever.
- It **validates** spec edits in the same turn.
- It runs `rqml check` at turn-end as an **advisory** safety net (opencode cannot
  block a turn from ending), and names **CI as the authoritative gate**.

This is a deliberate, stated divergence from the Claude Code and Codex siblings,
which can refuse to finish a turn on a failing check. opencode cannot, so the
plugin moves the hard enforcement to the *moment of the edit* and is honest that
turn-end is advisory. See the [README](../README.md#enforcement-on-opencode--the-honest-version)
for the enforcement table, and the [Quickstart](quickstart.md) to try it.
