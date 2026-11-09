import { basename } from "node:path";

const FIRST = 0;
const NEXT = 1;
const PAIR = 2;
const QUOTES = new Set(["'", '"']);
const SEPARATORS = new Set(["&&", "||", ";", "\n", "|"]);
const STABLE_COMMANDS = new Set(["git", "gh", "echo", "pwd", "date"]);

function rawCommands(command: string): string[][] {
  const commands: string[][] = [];
  let words: string[] = [];
  for (const [token] of command.matchAll(
    /"[^"]*"|'[^']*'|&&|\|\||[;\n|]|[^\s"';&|]+/g,
  )) {
    if (SEPARATORS.has(token)) {
      commands.push(words);
      words = [];
    } else words.push(token);
  }
  commands.push(words);
  return commands.filter((args) => args.length > FIRST);
}

function unquote(word: string): string {
  if (QUOTES.has(word.slice(FIRST, NEXT))) return word.slice(NEXT, -NEXT);
  return word;
}

/** Literal argv only; never evaluates shell text. */
export function shellCommands(command: string): string[][] {
  return rawCommands(command).map((args) => args.map(unquote));
}

function assignmentPrefix(word: string | undefined): boolean {
  return typeof word === "string" && word.endsWith("=");
}

function bindingValue(words: readonly string[]): string | undefined {
  if (words.length === NEXT) return words[FIRST];
  if (words.length === PAIR && assignmentPrefix(words[FIRST])) {
    return words.join("");
  }
  return undefined;
}

function binding(command: readonly string[]): string | undefined {
  const value = bindingValue(command.filter((word) => word !== "export"));
  if (value === undefined) return undefined;
  return /^[A-Za-z_]\w*=/.test(value) ? value : undefined;
}

function expand(raw: string, variables: ReadonlyMap<string, string>): string {
  const value = unquote(raw);
  if (raw.startsWith("'")) return value;
  return value.replace(/\$(?:\{[A-Za-z_]\w*\}|[A-Za-z_]\w*)/g, (reference) => {
    const name = reference.replace(/^\$\{?|\}$/g, "");
    return variables.get(name) ?? reference;
  });
}

function assign(value: string, variables: Map<string, string>): void {
  const separator = value.indexOf("=");
  const name = value.slice(FIRST, separator);
  const sha = expand(value.slice(separator + NEXT), variables);
  if (/^[a-f0-9]{40}$/.test(sha)) variables.set(name, sha);
  else variables.delete(name);
}

function resolveCommand(
  raw: readonly string[],
  variables: Map<string, string>,
): string[] | undefined {
  const assignment = binding(raw);
  if (assignment !== undefined) {
    assign(assignment, variables);
    return undefined;
  }
  const words = raw.map((word) => expand(word, variables));
  const executable = basename(words[FIRST] ?? "");
  if (!STABLE_COMMANDS.has(executable)) variables.clear();
  return words;
}

/** Resolve only earlier, standalone literal SHA assignments in this same Bash call. */
export function pinnedShellCommands(command: string): string[][] {
  // Substitutions and escaped shell syntax are intentionally not an evidence interpreter.
  if (
    command.includes("$(") ||
    command.includes("`") ||
    command.includes("\\")
  ) {
    return shellCommands(command);
  }
  const variables = new Map<string, string>();
  return rawCommands(command)
    .map((raw) => resolveCommand(raw, variables))
    .filter((words) => words !== undefined);
}
