# ADR-0004: Deliver the command surfaces through multiple channels

- Status: Accepted
- Date: 2026-06-26
- Classification: discretionary_design_choice
- Decision ID (in `requirements.rqml`): `DEC-COMMAND-SURFACES`
- Related requirements: `REQ-COMMAND-SURFACES`, `REQ-CMD-INIT`, `REQ-CMD-STATUS`, `REQ-CMD-CHECK`, `REQ-CMD-DESIGN`, `REQ-CMD-PLAN`, `REQ-CMD-REVIEW`, `REQ-MCP-BUNDLED`
- Related ADRs: ADR-0003 (config hook for programmatic registration); rqml-codex `DEC-SKILLS-NOT-CUSTOM-PROMPTS` (sibling precedent)
- Affected components: rqml-opencode (`config.command` injection; plugin `tool` registrations; `@rqml/mcp`)

## Context

The command surfaces — init, status, check, design, plan, review — are explicit
entry points for the developer and the agent. The siblings each ship them as a
host-native bundle: rqml-claude as `commands/*.md`, rqml-codex as
`skills/<name>/SKILL.md`. opencode has **neither** as a plugin-distributable
artifact.

opencode commands are discovered only as on-disk markdown (`.opencode/command/`,
project or global) or as JSON entries under the configuration's `command` key.
There is **no documented path to bundle `.md` command files inside an installed
npm plugin package**. A plugin can, however, contribute commands programmatically
(JSON commands via the `config` hook, ADR-0003), register custom **tools** the
agent can call (the `tool` hook), and bundle the `@rqml/mcp` server
(`REQ-MCP-BUNDLED`).

## Decision drivers

- The surfaces must reach the user **from an installed package**, not only from
  files a user hand-places.
- Resilience to which registration paths a given opencode host actually honors.
- Avoid betting every surface on a single semi-internal path (the config hook is
  itself feature-detected, ADR-0003).

## Options considered

### Option 1: Bundle `.md` command files in the npm package

Ship `command/*.md` inside the package and rely on discovery.

**Pros**
- Mirrors the rqml-claude shape directly.

**Cons**
- No documented mechanism for opencode to discover markdown commands from an
  installed npm package — unsupported, so the surfaces would simply not appear.

### Option 2: Single channel — config-hook JSON commands only

Register all surfaces solely by mutating `config.command` in the config hook.

**Pros**
- One clean mechanism.

**Cons**
- Goes dark wherever config-command injection is unsupported or the config hook
  shape changes — the same forward-compat risk as ADR-0003, with no redundancy.

### Option 3: Multi-channel delivery (chosen)

Inject JSON commands through the config hook, **and** expose the same actions as
plugin-registered tools, **and** surface them through the bundled `@rqml/mcp`
server; document the on-disk `.opencode/command/` markdown form as a manual
option.

**Pros**
- The surfaces work across host configurations and degrade gracefully.
- Reuses the bundled MCP server the plugin already requires.

**Cons**
- The same action is described through more than one channel, a maintenance and
  consistency burden.

## Decision

Adopt **Option 3** (`REQ-COMMAND-SURFACES`). The init/status/check/design/plan/
review surfaces ship as config-hook JSON commands (ADR-0003), are additionally
exposed as plugin-registered tools and through `@rqml/mcp`, and the on-disk
markdown install is documented as a manual alternative. Each surface remains a
thin wrapper over the rqml CLI and MCP — no requirements logic of its own
(`DEC-THIN-ADAPTER`). This mirrors the intent of rqml-codex's pivot away from
non-distributable custom prompts (`DEC-SKILLS-NOT-CUSTOM-PROMPTS`), adapted to
opencode's channels.

## Consequences

### Positive

- The surfaces remain available regardless of which registration paths a host
  supports.
- Delivery reuses the already-required MCP server and the config hook.

### Negative

- One action, several channels: naming and behavior must be kept aligned across
  config commands, plugin tools, and MCP tools.
- More surface area to test for parity.

## Supersession

None. Revisit when opencode's v2 plugin API offers first-class command/skill
registration, which may let the surfaces collapse to a single supported channel
(`ISS-V2-PLUGIN-API`).
