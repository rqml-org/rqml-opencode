<p align="center">
  <img src="https://rqml.org/img/RQML_logo_transparent.png" alt="RQML logo" width="280">
</p>

<h1 align="center">Make opencode code from the spec, not from a fading chat thread.</h1>

<p align="center">
  <strong>rqml-opencode</strong> is the RQML plugin for
  <a href="https://opencode.ai">opencode</a>. It anchors every session on your
  requirements, hard-blocks edits to code that implements an unapproved
  requirement at the tool boundary, and runs the deterministic
  <code>rqml check</code> gate — advisory in-session, authoritative in CI.
</p>

<p align="center">
  <a href="docs/quickstart.md">Quickstart</a> •
  <a href="docs/why-rqml-opencode.md">Why rqml-opencode</a> •
  <a href="docs/troubleshooting.md">Troubleshooting</a> •
  <a href="https://rqml.org">RQML</a>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/@rqml/cli?label=%40rqml%2Fcli&color=8568ab" alt="@rqml/cli on npm">
  <img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License">
</p>

---

## What is RQML?

[RQML](https://rqml.org) is Requirements Markup Language: a human-readable,
tool-readable way to make software intent explicit. A project keeps a durable
requirements artifact, usually `requirements.rqml`, with goals, scenarios,
requirements, verification, and trace links.

That matters more when agents write code. opencode can implement quickly, but it
cannot reliably infer all of the product boundaries, edge cases, non-functional
requirements, or prior decisions that live outside the prompt. RQML gives the
agent structured context and gives the team a deterministic way to ask: does the
code still match the spec?

The verdict is not model judgment. `rqml check` validates the spec, checks
coverage and drift, and fails when implementation or tests no longer line up with
the requirement trace.

## What this plugin does

`rqml-opencode` is a programmatic opencode plugin that wires the RQML loop into
the host's hooks:

- **Session anchoring** — a freshly computed `rqml status` (spec id, coverage,
  drift) plus the five-stage loop is injected into context at the start of work.
- **Spec-edit feedback** — edits to `.rqml` files are validated immediately, so
  invalid requirements are repaired in the same turn.
- **Pre-edit gate** — an edit to code already linked to a **non-approved**
  requirement is hard-denied at the tool boundary, with the deterministic
  `rqml gate` verdict as the reason.
- **Advisory turn-end check** — when a turn goes idle, `rqml check` runs and
  surfaces any findings; see the honesty note below.
- **Command surfaces** — `/rqml-init`, `/rqml-status`, `/rqml-check`,
  `/rqml-design`, `/rqml-plan`, `/rqml-review` drive each stage of the loop.
- **Agent tools & craft** — the bundled `@rqml/mcp` server (`show`, `impact`,
  `link`, `skeleton`, `check`, …) and the vendored authoring craft are registered
  for you.

Every verdict comes from the `rqml` CLI — no language model is in the enforcement
path, so what surfaces locally is exactly what blocks CI.

## Enforcement on opencode — the honest version

opencode's plugin model cannot block a turn from ending, so this plugin is
deliberately honest about what it enforces and where:

| Where | Strength | What happens |
|-------|----------|--------------|
| **At the edit** (tool boundary) | **Hard block** | An edit to code implementing a non-approved requirement is denied. |
| **On a spec edit** | In-turn feedback | `rqml validate` diagnostics are returned in the same turn. |
| **At turn-end** (idle) | **Advisory** | `rqml check` runs and surfaces findings, but **never blocks** — opencode has no turn-end gate. |
| **In CI** | **Authoritative** | `rqml check` (and strict) gate every pull request and push. |

Two boundaries are stated plainly, never hidden: edits made by **subagents**
spawned through the task tool are **not** intercepted by the pre-edit gate
([opencode #5894](https://github.com/sst/opencode/issues/5894)), and the
turn-end check is advisory. **CI is the backstop for both.**

## Install

Add the plugin to your `opencode.json` and keep the strictness convention in
`AGENTS.md`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@rqml/opencode"]
}
```

On a host that honors programmatic registration, the plugin registers the
`@rqml/mcp` server, the command surfaces, and the authoring craft for you. If
your host does not, add them manually (see
[Troubleshooting](docs/troubleshooting.md)):

```json
{
  "plugin": ["@rqml/opencode"],
  "mcp": { "rqml": { "type": "local", "command": ["npx", "-y", "@rqml/mcp"] } }
}
```

The plugin runs the `rqml` CLI through opencode's shell; install it once with
`npm i -g @rqml/cli`, or rely on `npx -y @rqml/cli`. A Node.js 18+ runtime is
assumed.

## First 10 minutes

The [Quickstart](docs/quickstart.md) takes you from install to your first
passing `rqml check`: adopt RQML with `/rqml-init`, draft and approve a
requirement, implement it, record the trace with `rqml link`, and watch the gate
go green. New to RQML? Start with [Why rqml-opencode](docs/why-rqml-opencode.md).

## License

Apache-2.0.
