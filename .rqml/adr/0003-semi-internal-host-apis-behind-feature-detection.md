# ADR-0003: Build on opencode's semi-internal and experimental APIs behind feature detection

- Status: Accepted
- Date: 2026-06-26
- Classification: discretionary_design_choice
- Decision IDs (in `requirements.rqml`): `DEC-CONFIG-HOOK-REGISTER`, `DEC-CONTEXT-INJECTION`
- Related requirements: `REQ-CONFIG-HOOK-REGISTER`, `REQ-EXPERIMENTAL-API-RISK`, `REQ-HOOK-ANCHOR`, `REQ-MCP-BUNDLED`, `REQ-SKILL-AUTHORING`
- Related ADRs: ADR-0004 (command surfaces ride the config hook)
- Affected components: rqml-opencode (`config` hook; `experimental.chat.system.transform`; manual-fallback paths)

## Context

The zero-configuration experience the plugin wants depends on two opencode
capabilities that are confirmed in the `@opencode-ai/plugin` type definitions and
core runtime but are **not advertised in the public documentation** or are marked
**experimental**:

- **The `config` hook** — `config?: (input: Config) => Promise<void>` receives the
  resolved configuration by reference; mutating it in place registers an MCP
  server (`config.mcp`), JSON commands (`config.command`), and instruction files
  (`config.instructions`) with no edit to `opencode.json` by the developer. Real,
  but semi-internal (`CON-SEMI-INTERNAL-API`).
- **`experimental.chat.system.transform`** — `(input, output: { system: string[] })`
  lets the plugin push a freshly computed `rqml status` string onto the system
  prompt per request, the cleanest analog to the siblings' dynamic SessionStart
  anchor. Real, but in the `experimental.` namespace and subject to change
  (`RISK-API-DRIFT`).

The alternative documented mechanisms are clunkier: the user manually adds the
MCP server to `opencode.json`, and a static `instructions`/AGENTS.md file
provides the same anchor text every session rather than a recomputed one.

## Decision drivers

- Zero-config install (`GOAL-ZERO-CONFIG`) wants programmatic registration.
- A dynamic, per-session anchor (parity with the siblings) wants
  `system.transform`.
- Forward-compatibility: a session must **never** crash if a semi-internal or
  experimental API is renamed or removed.

## Options considered

### Option 1: Strictly documented surface only

Require the user to add the MCP server to `opencode.json`; ship the anchor as a
static `instructions`/AGENTS.md file.

**Pros**
- Maximally stable against opencode changes; no reliance on undocumented shape.

**Cons**
- More setup friction; a static anchor cannot reflect live coverage/drift.
- Surrenders the zero-config and dynamic-anchor goals.

### Option 2: Feature-detected enhancements with manual fallbacks (chosen)

Build on the config hook and `system.transform` as enhancements, each guarded by
feature detection and backed by a documented manual fallback; absence or a shape
change degrades to the fallback with a one-time note, never a crash.

**Pros**
- One-line install and a dynamic anchor *where supported*.
- The risk is isolated behind detection; a future opencode release degrades the
  plugin rather than breaking it.

**Cons**
- Two code paths (enhanced + fallback) to build and test (`TC-API-ABSENT`).
- A standing dependency on semi-internal behavior to track across opencode
  releases.

### Option 3: Wait for the v2 plugin API

Defer until opencode's forthcoming v2 plugin API exposes first-class
agent/command/skill/MCP registration.

**Pros**
- A supported, stable registration contract.

**Cons**
- Not stable yet (`ISS-V2-PLUGIN-API`); waiting blocks shipping any zero-config
  experience now.

## Decision

Adopt **Option 2**. Feature-detect the `config` hook and
`experimental.chat.system.transform` at load. The anchor injects through
`system.transform` → `chat.message` part → static `instructions` file, in that
order of preference (`REQ-HOOK-ANCHOR`, `DEC-CONTEXT-INJECTION`). Registration of
the MCP server, the command surfaces, and the vendored craft goes through the
config hook, falling back to documented `opencode.json` entries
(`REQ-CONFIG-HOOK-REGISTER`, `REQ-MCP-BUNDLED`, `REQ-SKILL-AUTHORING`). Any
absent capability or unexpected shape degrades to the manual path with a single
note and never throws (`REQ-EXPERIMENTAL-API-RISK`).

## Consequences

### Positive

- Single-entry install and a live, dynamic anchor where the host honors the
  capabilities.
- Sessions never crash on API drift; the failure mode is graceful degradation.
- The risk is localized to feature-detection seams that are explicit and tested.

### Negative

- More paths to maintain and test (enhanced plus fallback).
- A standing obligation to track opencode releases for changes to the config hook
  and the experimental namespace.
- The manual fallback UX is meaningfully worse, so documentation must cover both
  routes honestly.

## Supersession

None. When opencode's v2 plugin API stabilizes, prefer its first-class
registration over the config-hook mutation and re-evaluate the experimental
anchor path (`ISS-V2-PLUGIN-API`).
