# Quickstart — install to first green check

This takes you from nothing to a passing `rqml check`. It assumes
[opencode](https://opencode.ai) and Node.js 18+.

## 1. Install the toolchain and the plugin

```bash
npm i -g @rqml/cli          # the rqml CLI (or rely on npx -y @rqml/cli)
```

Add the plugin to your project's `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@rqml/opencode"]
}
```

Start opencode in your project. The plugin registers the `@rqml/mcp` server, the
`/rqml-*` command surfaces, and the authoring craft automatically. If a surface
is missing, see [Troubleshooting](troubleshooting.md) for the manual snippet.

## 2. Adopt RQML

Run the init surface and let opencode interview you:

```
/rqml-init
```

It runs `rqml init` to scaffold `requirements.rqml` and an `AGENTS.md` marker,
then helps you elicit and draft your first requirements. Set the project's
strictness in `AGENTS.md` (`relaxed`, `standard`, `strict`, or `certified`);
`standard` is the default.

## 3. Approve a requirement

Only **approved** requirements drive implementation. Render and accept them:

```
/rqml-review
```

For each requirement you confirm, the agent runs `rqml approve <REQ-ID>`.

## 4. Implement and trace

Read the requirement, implement it, and record the trace — the plugin guides
this through `/rqml-check`:

```bash
rqml show REQ-XXX                 # read the requirement and its acceptance criteria
rqml link REQ-XXX src/feature.ts  # record the implements edge + drift baseline
rqml link REQ-XXX test/feature.test.ts --type verifiedBy
```

If you try to edit code linked to a requirement you have **not** approved, the
pre-edit gate denies the edit and names the requirement — approve it first.

## 5. Verify

```bash
rqml check        # must exit 0
```

When a turn goes idle, the plugin runs this for you and surfaces any findings as
an advisory toast (it does not block — CI does). Add the same gate to CI so it is
enforced authoritatively:

```yaml
- run: npx -y @rqml/cli check
- run: npx -y @rqml/cli check --strictness strict
```

You now have a requirement, an approval, an implementation, a test, and a green
gate — locally and in CI.
