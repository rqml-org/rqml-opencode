# Architecture Decision Records

This directory captures the major architecture and design decisions for the
`rqml-opencode` plugin. Each ADR is short, immutable once accepted, and follows
the RQML development-process design format
(https://www.rqml.dev/vscode/docs/development-process/design): a metadata block
(Status, Date, Classification, Decision ID, Related requirements, Related ADRs,
Affected components) followed by Context, Decision drivers, Options considered,
Decision, Consequences, and Supersession.

When a decision is revisited, do not edit the existing ADR — write a new one that
supersedes it, and mark the older one `Superseded by ADR-NNNN`.

These ADRs record the decisions forced by opencode's plugin model, which inverts
the enforcement shape the sibling plugins (rqml-claude, rqml-codex) rely on: the
host offers a hard block at the tool boundary but none at turn-end. The host-
forced decisions with no real alternative — a programmatic plugin
(`DEC-PLUGIN-PROGRAMMATIC`) and npm-only distribution (`DEC-DISTRIBUTION-NPM`) —
are recorded as `<decision>` elements in `requirements.rqml`, not as ADRs.

## Index

| # | Title | Classification | Status |
|---|-------|----------------|--------|
| [0001](0001-pre-edit-gate-as-primary-enforcement.md) | Center in-session enforcement on the tool boundary, since opencode cannot gate turn-end | discretionary_design_choice | Accepted |
| [0002](0002-advisory-turn-end-check-ci-authoritative.md) | Make the turn-end check advisory, with CI as the authoritative gate | discretionary_design_choice | Accepted |
| [0003](0003-semi-internal-host-apis-behind-feature-detection.md) | Build on opencode's semi-internal and experimental APIs behind feature detection | discretionary_design_choice | Accepted |
| [0004](0004-multi-channel-command-surfaces.md) | Deliver the command surfaces through multiple channels | discretionary_design_choice | Accepted |

## Cross-reference

Each ADR names the `<decision id="DEC-…">` element it expands in
`rqml-opencode/requirements.rqml`; the `.rqml` decision is the agent-readable
summary and this directory holds the long-form context. These ADRs frequently
reference the upstream `rqml` engine's own records (in `rqml/.rqml/adr/`) — in
particular ADR-0008 (approval-before-implementation gate), ADR-0001 (spec-
enforcement control loop), and ADR-0003 (deterministic checking) — since the
plugin is a thin adapter over that engine.
