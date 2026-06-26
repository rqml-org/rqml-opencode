/**
 * Command-surface templates — REQ-CMD-INIT/STATUS/CHECK/DESIGN/PLAN/REVIEW,
 * REQ-PATH-DISCIPLINE, DEC-THIN-ADAPTER.
 *
 * Each surface is a workflow prompt that drives the agent through one stage of
 * the RQML loop using the rqml CLI and the @rqml/mcp tools. The plugin computes
 * nothing here — the templates only direct the agent to path-input CLI calls and
 * `rqml link`, never to inline XML (REQ-PATH-DISCIPLINE). The honest posture text
 * is reused from one source (content/anchor.ts).
 */
import { ENFORCEMENT_POSTURE, FIVE_STAGE_LOOP } from "../content/anchor.ts";
import { SUBAGENT_COVERAGE_DISCLOSURE } from "../content/messages.ts";

export interface CommandSurface {
  /** Suffix of the plugin tool id (`rqml_wf_<key>`). */
  key: string;
  /** The config command name, invoked as `/<slash>`. */
  slash: string;
  /** Concise description for the TUI and for tool matching. */
  description: string;
  /** The workflow prompt sent to the model. */
  template: string;
}

const init = [
  "Adopt RQML in this project — the spec-first workflow where code follows requirements.",
  "",
  "1. Run `rqml init` to scaffold requirements.rqml and the AGENTS.md project marker.",
  "2. Interview the developer about the goal, scope, actors, constraints, and acceptance criteria. Do NOT invent requirements — elicit them; capture open questions as <notes> or <issue> elements.",
  "3. Draft the first requirements into requirements.rqml. Use `rqml skeleton req` for schema-valid snippets and `rqml validate` to check as you go. Set status=\"draft\".",
  "4. Ask the developer to confirm each requirement; only approved requirements drive implementation (use the rqml-review surface to approve them).",
  "5. Tell the developer to add this plugin to their opencode.json \"plugin\" array (or .opencode/plugins/) so its enforcement hooks are active, and to run `rqml check` in CI.",
  "",
  FIVE_STAGE_LOOP,
].join("\n");

const status = [
  "Re-anchor on the RQML spec and report the honest enforcement posture.",
  "",
  "1. Run `rqml status` and summarize: the spec docId, requirement coverage, unverified/unimplemented counts, and any drift.",
  "2. State the enforcement posture plainly:",
  `   ${ENFORCEMENT_POSTURE}`,
  `   ${SUBAGENT_COVERAGE_DISCLOSURE}`,
  "3. Point to the next useful action — read a requirement with `rqml show <REQ-ID>`, implement it, record a trace with `rqml link`, or run the rqml-check surface.",
].join("\n");

const check = [
  "Run the RQML gate and resolve every finding through the loop.",
  "",
  "1. Run `rqml check`. If it exits 0, report that the gate passes.",
  "2. For each finding, resolve it deterministically:",
  "   - `rqml show <REQ-ID>` to read the requirement and its acceptance criteria.",
  "   - `rqml impact <ID>` before changing an existing artifact.",
  "   - Implement the specified behavior, or record the trace with `rqml link <REQ-ID> <path>` (add `--type verifiedBy` for tests).",
  "   - Re-run `rqml check`.",
  "3. Repeat until `rqml check` exits 0. Never silently change the spec to match the code — if the spec is wrong, propose a correction and wait for the developer.",
].join("\n");

const design = [
  "Run the RQML Design stage for the decision: $ARGUMENTS",
  "",
  "1. Classify the decision. It is ADR-worthy only if it has real alternatives or constrains future work; skip the ADR for low-level implementation details.",
  "2. If ADR-worthy, write an Architecture Decision Record to .rqml/adr/ named NNNN-kebab-slug.md (the next number in the flat, sequential series), following the canonical format: a metadata block (Status, Date, Classification, Related requirements, Related ADRs, Affected components) then Context, Decision drivers, Options considered, Decision, Consequences, and Supersession. Update the .rqml/adr/README.md index table.",
  "3. ADRs are immutable once accepted — to revisit one, write a new ADR that supersedes it and mark the old one superseded. Do not implement the decision here.",
].join("\n");

const plan = [
  "Run the RQML Plan stage.",
  "",
  "1. Confirm the requirements you are planning against are approved (`rqml status`); plan only approved requirements.",
  "2. Create or update .rqml/plan.md: break the work into agent-sized stages. Each stage names its scope (the requirement IDs it addresses), the agent task, the files it touches, its key output, and how to verify it.",
  "3. Do not implement anything — this stage only produces the plan. End with a readiness verdict and any blockers.",
].join("\n");

const review = [
  "Run the RQML review — accept requirements with the developer.",
  "",
  "1. Render the draft and review requirements as an overview (`rqml overview`) and a traceability matrix (`rqml matrix`).",
  "2. Present them to the developer for acceptance, one at a time where useful.",
  "3. For each requirement the developer confirms, run `rqml approve <REQ-ID>` to transition it to approved; leave the others unchanged. The human decides; the toolchain performs the status edit — do not hand-edit the XML.",
].join("\n");

export const COMMANDS: CommandSurface[] = [
  { key: "init", slash: "rqml-init", description: "Adopt RQML: scaffold the spec, elicit the first requirements, and arm enforcement.", template: init },
  { key: "status", slash: "rqml-status", description: "Re-anchor on the RQML spec and report the honest enforcement posture.", template: status },
  { key: "check", slash: "rqml-check", description: "Run the RQML gate (rqml check) and resolve each finding through the loop until it passes.", template: check },
  { key: "design", slash: "rqml-design", description: "Record an architecture decision as an ADR in .rqml/adr/ (the RQML Design stage).", template: design },
  { key: "plan", slash: "rqml-plan", description: "Break approved requirements into a staged implementation plan at .rqml/plan.md.", template: plan },
  { key: "review", slash: "rqml-review", description: "Render and accept draft requirements, approving each confirmed one via rqml approve.", template: review },
];
