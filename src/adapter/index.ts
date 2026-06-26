/**
 * The thin adapter layer: the only code that locates specs, talks to the rqml
 * CLI, reads strictness, and gates fail-open warnings. Every hook builds on
 * this and on nothing else (REQ-THIN-ADAPTER).
 */
export { findSpec, findSpecForFile } from "./discover.ts";
export type { SpecLocation } from "./discover.ts";

export { runRqml, rqmlJson, classifyExit, RQML_CLI_RANGE } from "./cli.ts";
export type { Shell, ShellInvocation, ShellOutput, RqmlResult, Verdict } from "./cli.ts";

export { readStrictness } from "./strictness.ts";
export type { Strictness } from "./strictness.ts";

export { createWarnOnce } from "./failopen.ts";
export type { WarnOnce } from "./failopen.ts";
