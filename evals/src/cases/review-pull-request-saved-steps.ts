import type { ToolCall } from "#/observation/agent-query.ts";

// Only split verify && render; echo render=$?; dry-run; echo dry=$?.
// The first zero therefore covers both the validator and the guarded render.
const BATCH =
  /^(?<prefix>(?:\w+=[^;&\n]+;\s*)*)(?<verify>python3 -I [^;&\n]+) && (?<render>python3 -I [^;&\n]+);\s*echo render=\$\?;\s*(?<dry>python3 -I [^;&\n]+);\s*echo dry=\$\?$/u;
const OUTPUT =
  /^(?<render>sha256: [a-f0-9]{64})\nrender=0\n(?<dry>POST review to [\s\S]+)\ndry=0\n?$/u;

function outputFields(call: ToolCall) {
  const { result } = call;
  if (result === undefined || result.isError) return undefined;
  return OUTPUT.exec(result.content)?.groups;
}

function commandFields(call: ToolCall) {
  return BATCH.exec(String(call.input["command"]).trim())?.groups;
}

export function savedPreviewSteps(call: ToolCall): ToolCall[] {
  if (call.name !== "Bash") return [call];
  const steps = commandFields(call);
  const output = outputFields(call);
  if (steps === undefined || output === undefined) return [call];
  return ["verify", "render", "dry"].map((step) => ({
    ...call,
    input: { command: `${steps["prefix"]}${steps[step]}` },
    result: { content: output[step] ?? "", isError: false, truncated: false },
  }));
}
