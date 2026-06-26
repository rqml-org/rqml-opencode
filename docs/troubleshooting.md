# Troubleshooting

## The plugin does nothing

The enforcement hooks are **dormant outside RQML projects** by design. If there
is no `requirements.rqml` in the working directory or a parent directory, the
anchor, pre-edit gate, and spec validation stay silent. Run `/rqml-init` to adopt
RQML, or check that you opened the project at or below the spec's directory.

## "rqml CLI not found"

The plugin runs the `rqml` CLI through opencode's shell. Install it
(`npm i -g @rqml/cli`) or ensure `npx -y @rqml/cli` works. While the CLI is
missing the plugin **fails open**: it warns once and blocks nothing. CI still
runs the real gate.

## No anchor / commands / MCP tools appeared

The plugin registers its contributions through opencode's `config` hook. If your
host build does not honor it, the plugin degrades gracefully (it warns once) and
you add them to `opencode.json` manually:

```json
{
  "plugin": ["@rqml/opencode"],
  "mcp": { "rqml": { "type": "local", "command": ["npx", "-y", "@rqml/mcp"] } },
  "instructions": [
    "node_modules/@rqml/opencode/craft/authoring.md",
    "node_modules/@rqml/opencode/craft/monorepo.md"
  ]
}
```

The `/rqml-*` workflows are also available as `rqml_wf_*` plugin tools the agent
can call directly, so they work even if config-command injection does not.

## A turn ended with a failing check

That is expected. **opencode has no turn-end gate**, so this plugin's idle check
is advisory — it surfaces findings but cannot block a turn. The hard, blocking
enforcement is the **pre-edit gate** (at the moment of the edit) and **CI**
(`rqml check` on every push and pull request). Treat the advisory toast as a
prompt to resolve findings before you merge.

## An edit by a subagent was not blocked

The pre-edit gate fires for the main agent's `edit`/`write` calls, but it does
**not** intercept edits made inside subagents spawned through the task tool
([opencode #5894](https://github.com/sst/opencode/issues/5894)). This is a known
coverage boundary. CI runs the full gate over every change and is the backstop.

## The gate fails on coverage at `strict`

At `strict` and `certified`, `rqml check` blocks on unimplemented or unverified
requirements (ghost features). Either implement and link the behavior
(`rqml link`), add a verifying test (`rqml link … --type verifiedBy`), or — if
the requirement is genuinely not yet started — keep the project at `standard`
until you are ready.

## A monorepo root shows no single spec

If the directory has no spec of its own but package specs beneath it, the plugin
treats it as a **workspace root**: the anchor lists the units and the idle check
runs `rqml check --workspace`. A directory with no specs anywhere stays dormant.
