import { isAbsolute, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { FIXTURE_ROOT_PATH } from "#/cases/shared-checks.ts";
import type { Observation, ToolCall } from "#/observation/agent-query.ts";

const FIRST = 0;
const ONE = 1;
const VALUE = /^[\w./-]+$/u;
const VARIABLE = /\$\{[A-Za-z_]\w*\}|\$[A-Za-z_]\w*/gu;
const BINDING =
  /^(?<name>SKILL_DIR|RUN_DIR|OUTPUT_FILE|PAYLOAD_FILE|SAVED_REVIEW|HASH|RUN|S|R)=(?<value>.+)$/u;

type Bindings = ReadonlyMap<string, string>;

function expand(text: string, bindings: Bindings): string {
  return text.replace(
    VARIABLE,
    (ref: string) => bindings.get(ref.replace(/^\$\{?|\}$/gu, "")) ?? ref,
  );
}

function resolveWord(raw: string, bindings: Bindings): string | undefined {
  const text = raw.replace(/^(?<quote>["'])(?<text>.*)\k<quote>$/u, "$<text>");
  const value = raw.startsWith("'") ? text : expand(text, bindings);
  return VALUE.test(value) ? value : undefined;
}

function addBinding(raw: string, bindings: Map<string, string>): boolean {
  const groups = BINDING.exec(raw)?.groups;
  if (groups === undefined) return false;
  const name = String(groups["name"]);
  const word = resolveWord(String(groups["value"]), bindings);
  if (word === undefined) return false;
  bindings.set(name, word);
  return true;
}

interface ScriptCall {
  args: string[];
  stdin?: string;
}

function commandWords(text: string, bindings: Bindings): string[] | undefined {
  const words: string[] = [];
  for (const raw of text.trim().split(/[ \t]+/u)) {
    const word = resolveWord(raw, bindings);
    if (word === undefined) return undefined;
    words.push(word);
  }
  return words;
}

type ScriptPath = (file: string) => boolean;

export function fixtureRoots(observation: Observation): string[] {
  return observation.repoFiles?.[FIXTURE_ROOT_PATH]?.split("\n") ?? [];
}

function isReviewScript(
  file: string,
  script: string,
  roots?: readonly string[],
): boolean {
  if (file.split("/").includes("..")) return false;
  const installed = `.claude/skills/review-pull-request/scripts/${script}`;
  const shipped = fileURLToPath(
    new URL(
      `../../../skills/review-pull-request/scripts/${script}`,
      import.meta.url,
    ),
  );
  return (
    [installed, shipped].includes(normalize(file)) ||
    installedScript(file, installed, roots)
  );
}

function installedScript(
  file: string,
  installed: string,
  roots?: readonly string[],
): boolean {
  if (roots === undefined) return file.endsWith(`/${installed}`);
  return roots.some((root) => file === `${root}/${installed}`);
}

function scriptArgs(
  text: string,
  bindings: Bindings,
  matchesScript: ScriptPath,
): string[] | undefined {
  const words = commandWords(text, bindings);
  if (words === undefined) return undefined;
  return isolatedScriptArgs(words, matchesScript);
}

export function isolatedScriptArgs(
  words: readonly string[],
  matchesScript: ScriptPath,
): string[] | undefined {
  const [python, flag, file, ...args] = words;
  if (`${python} ${flag}` !== "python3 -I") return undefined;
  return matchesScript(String(file)) ? args : undefined;
}

function parseScript(
  command: string,
  bindings: Bindings,
  matchesScript: ScriptPath,
): ScriptCall | undefined {
  const [argv, input, ...extra] = command.split("<");
  if (extra.length > FIRST) return undefined;
  const args = scriptArgs(String(argv), bindings, matchesScript);
  if (args === undefined) return undefined;
  if (input === undefined) return { args };
  return withInput(input, args, bindings);
}

function withInput(
  input: string,
  args: string[],
  bindings: Bindings,
): ScriptCall | undefined {
  const stdin = resolveWord(input.trim(), bindings);
  return stdin === undefined ? undefined : { args, stdin };
}

function consumeFixtureCd(
  prefix: string[],
  roots: readonly string[] = [],
): boolean {
  const [first = ""] = prefix;
  if (!first.startsWith("cd ")) return true;
  prefix.shift();
  const directory = resolveWord(first.slice("cd ".length).trim(), new Map());
  return roots.includes(String(directory));
}

function parsePrefix(
  prefix: string[],
  roots: readonly string[] | undefined,
  bindings: Map<string, string>,
): boolean {
  return (
    consumeFixtureCd(prefix, roots) &&
    prefix.every((step) => addBinding(step, bindings))
  );
}

const STATUS_ECHO = /;\s*echo exit=\$\?$/u;

function checkedCommand(call: ToolCall): string | undefined {
  const text = call.input["command"];
  if (call.name !== "Bash" || typeof text !== "string") return undefined;
  return withoutStatusEcho(text.trim(), call.result?.content);
}

function withoutStatusEcho(command: string, output = ""): string | undefined {
  if (!STATUS_ECHO.test(command)) return command;
  return /\nexit=0\n?$/u.test(output)
    ? command.replace(STATUS_ECHO, "")
    : undefined;
}

function fixtureBindings(roots: readonly string[] = []): Map<string, string> {
  const [cwd] = roots;
  return new Map(cwd === undefined ? [] : [["PWD", cwd]]);
}

/** Prefixes may bind literal paths; a trailing status echo must confirm success. */
export function reviewScriptCall(
  call: ToolCall,
  script: string,
  roots?: readonly string[],
): ScriptCall | undefined {
  const command = checkedCommand(call);
  if (command === undefined) return undefined;
  const steps = command.split(/&&|[;\n]/u).map((step) => step.trim());
  const bindings = fixtureBindings(roots);
  const assignments = steps.slice(FIRST, -ONE);
  const prefix = assignments.filter(Boolean);
  if (!parsePrefix(prefix, roots, bindings)) {
    return undefined;
  }
  return parseScript(String(steps.at(-ONE)), bindings, (file) =>
    isReviewScript(file, script, roots),
  );
}

function matchesArgument(actual: string, expected: string): boolean {
  if (!/^\.handoffs\/|\.md$/u.test(expected)) return actual === expected;
  if (isAbsolute(actual) || actual.split("/").includes("..")) return false;
  return normalize(actual).replace(/\/$/u, "") === expected;
}

export function invokes(
  call: ToolCall,
  script: string,
  expected: readonly string[],
  roots?: readonly string[],
): boolean {
  const parsed = reviewScriptCall(call, script, roots);
  if (parsed === undefined || parsed.stdin !== undefined) return false;
  return (
    parsed.args.length === expected.length &&
    parsed.args.every((word, i) => matchesArgument(word, String(expected[i])))
  );
}
