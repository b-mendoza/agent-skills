import assert from "node:assert/strict";

const FIRST = 0;
const LAST = -1;
const AFTER = 1;
const unquote = (word: string) => word.replace(/^"(?<value>.*)"$/, "$<value>");
function resolveTarget(raw: string, before: string): string {
  const path = unquote(raw).replace(/^\$\{(?<key>\w+)\}\//, "$$$<key>/");
  const variable = /^\$(?<name>\w+)\//.exec(path)?.groups?.["name"];
  const target =
    variable === undefined ? path : substituteDirectory(path, variable, before);
  return relativeToCwd(target, before);
}
function relativeToCwd(target: string, before: string) {
  if (!target.startsWith(".handoffs/")) return target;
  const cwd = observedCwd(before.split("\0").at(LAST) ?? "");
  return ["", "."].includes(cwd) ? target : `${cwd}/${target}`;
}
function substituteDirectory(path: string, variable: string, before: string) {
  // Both substitutions have a known single-component result; never execute them.
  const source = before
    .replaceAll("\0", "\n")
    .replaceAll("$(date -u +%Y%m%dT%H%M%SZ)", "@utc@")
    .replaceAll("$(openssl rand -hex 2)", "@hex@");
  const assignment = assignedValue(source, variable);
  const cwd = observedCwd(before);
  const runId = unquote(assignedValue(source, "RUN_ID"));
  const dir = unquote(assignment)
    .replace(
      /\$(?:RUN_ID|\{RUN_ID\})$/,
      /^[\w@-]+$/.test(runId) ? runId : "$RUN_ID",
    )
    .replace(/^\$PWD(?=\/)/, cwd === "" ? "$PWD" : cwd)
    .replace(/\/$/, "");
  return /^[\w.@/-]+$/.test(dir)
    ? path.replace(`$${variable}/`, `${dir}/`)
    : path;
}
function observedCwd(before: string) {
  return groupValue(
    [...before.matchAll(/(?:^|[;&\n])[ \t]*cd (?<root>[^\s;&]+)/g)].at(LAST),
    "root",
  );
}
function assignedValue(source: string, variable: string) {
  const assignments = source.matchAll(
    new RegExp(
      `(?:^|[;&\\n])[ \\t]*(?:export\\s+)?(?:\\w+=[^\\s;&]+[ \\t]+)*${variable}=(?<value>[^\\s;&]+)`,
      "g",
    ),
  );
  return groupValue([...assignments].at(LAST), "value");
}
function groupValue(match: RegExpMatchArray | undefined, key: string) {
  return match?.groups?.[key] ?? "";
}
const sink =
  /(?:^|[;&|])[ \t]*cat[ \t]+>>?[ \t]*(?<path>[^\s;&|<>]+)[ \t]+<<[ \t]*(?<quote>['"]?)(?<end>\w+)\k<quote>$/;
const envelopePipe =
  /^\s*cat\s+<<(?<quote>["']?)(?<end>\w+)\k<quote>\s*\|\s*python3 -I "?\$SKILL_DIR\/scripts\/validate-output\.py"? envelope [\w-]+\s*$/;
function maskEnvelope(lines: string[], index: number, line: string) {
  const match = envelopePipe.exec(line)?.groups;
  if (match === undefined) return;
  const close = lines.indexOf(String(match["end"]), index + AFTER);
  if (inertBody(lines, index, close, match["quote"])) {
    lines.fill("", index + AFTER, close);
  }
}
// An unquoted heredoc expands command substitutions even in a JSON string.
// Only plain variable interpolations may be treated as inert here.
function inertBody(
  lines: string[],
  start: number,
  end: number,
  quote: string | undefined,
) {
  if (end <= start) return false;
  if (quote !== "") return true;
  const body = lines
    .slice(start + AFTER, end)
    .join("\n")
    .replace(/\$\{\w+\}|\$\w+/g, "");
  return !/[$`]/.test(body);
}
const validatorInput =
  /(?:^|[;&|])\s*python3 -I [^\s;&|]*validate-output\.py["']? digest [\w-]+\s+<<\s*(?<quote>['"])(?<end>\w+)\k<quote>\s*$/;
function maskValidatorInput(lines: string[], index: number, line: string) {
  const end = validatorInput.exec(line)?.groups?.["end"];
  if (end !== undefined) {
    maskData(lines, index, lines.indexOf(end, index + AFTER));
  }
}
// A printf/echo argument cannot execute its literal contents. Keep dynamic
// arguments (especially command substitutions) visible to mutation detection.
const outputCommand = /(?:^|[;&|])[ \t]*(?:printf|echo)\b/g;
const literalArguments = /^(?:[ \t]+(?:'[^']*'|"[^"$`\\]*"|[\w%./-]+))+/;
function outputEvidence(
  line: string,
  before: string,
  ownFile: (path: string) => boolean,
) {
  let result = line;
  for (const match of [...line.matchAll(outputCommand)].reverse()) {
    const start = match.index + match[FIRST].length;
    const literal = literalOutput(line.slice(start));
    if (literal === undefined) continue;
    if (literal.path !== "") {
      checkOutputTarget(
        literal.path,
        before + line.slice(FIRST, match.index),
        ownFile,
      );
    }
    result = `${result.slice(FIRST, start)} ${result.slice(start + literal.length)}`;
  }
  return result;
}
function outputPath(text: string) {
  return (
    /^[ \t]*>>?[ \t]*(?<path>[^\s;&|>]+)/.exec(text)?.groups?.["path"] ?? ""
  );
}
function outputArgument(text: string) {
  const argument =
    /^\s+"\$RUN_DIR"(?=\s*>)/.exec(text) ?? literalArguments.exec(text);
  return argument?.[FIRST] ?? "";
}
function literalOutput(text: string) {
  const literal = outputArgument(text);
  const tail = text.slice(literal.length).trimStart();
  const path = outputPath(tail);
  // Stdout is data unless piped to a consumer capable of executing it.
  if (path === "" && !plainOutputTail(tail)) return undefined;
  return { path, length: literal.length };
}
function plainOutputTail(tail: string) {
  return (
    tail === "" ||
    /^(?:;|&&)/.test(tail) ||
    /^\|\s*python3 -I "?\$SKILL_DIR\/scripts\/validate-output\.py"? envelope [\w-]+$/.test(
      tail,
    )
  );
}
function checkOutputTarget(
  path: string,
  before: string,
  ownFile: (path: string) => boolean,
) {
  const target = resolveTarget(path, before);
  if (target === "/dev/null") return;
  assert.ok(ownFile(target), `unexpected output destination: ${path}`);
}
// Remove only literal data directed into a run file. Leave interpreter stdin,
// executable substitutions and commands following the delimiter visible.
export function shellEvidence(
  command: string,
  ownFile: (path: string) => boolean,
  history = "",
  fixtureRoot = "",
): string {
  const prefix = `${history}\0\ncd ${fixtureRoot === "" ? "." : fixtureRoot}`;
  const lines = command
    .replace(/\bgit[ \t]+push[ \t]+--help(?=\s|[;&|]|$)/g, "git help push")
    .split("\n");
  return lines
    .map((line, index) => {
      const match = sink.exec(line.trimEnd());
      if (match?.groups === undefined) {
        maskValidatorInput(lines, index, line);
        maskEnvelope(lines, index, line);
        return outputEvidence(
          line,
          `${prefix}\n${lines.slice(FIRST, index).join("\n")}\n`,
          ownFile,
        );
      }
      const { path, end } = match.groups;
      assert.notEqual(path, undefined);
      assert.ok(typeof end === "string");
      const previous = [
        prefix,
        ...lines.slice(FIRST, index),
        line.slice(FIRST, match.index),
      ].join("\n");
      assert.ok(
        ownFile(resolveTarget(String(path), previous)),
        `unexpected heredoc destination: ${path}`,
      );
      const close = lines.indexOf(end, index + AFTER);
      if (inertBody(lines, index, close, match.groups["quote"])) {
        maskData(lines, index, close);
      }
      return outputEvidence(
        line,
        `${prefix}\n${lines.slice(FIRST, index).join("\n")}\n`,
        ownFile,
      );
    })
    .join("\n");
}
function maskData(lines: string[], start: number, end: number) {
  if (end <= start) return;
  // Shell scripts saved for subsequent execution are not inert proposal data.
  try {
    JSON.parse(lines.slice(start + AFTER, end).join("\n"));
    lines.fill("", start + AFTER, end);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
}
const wordPart = /[^\s'";&|()`]+|'[^']*'|"[^"]*"/;
const shellWords = new RegExp(`(?:${wordPart.source})+|[\\n;&|()\x60]`, "g");
function githubArgs(words: string[]) {
  const first = words.findIndex(
    (word) => !/^(?:\w+=|then$|do$|if$|env$|command$|exec$)/.test(word),
  );
  const args = words.slice(first + AFTER);
  if (words[first] === "gh") return [args];
  return nestedShell(words[first] ?? "", args);
}
function nestedShell(program: string, args: string[]): string[][] {
  const [flag, script = ""] = args;
  if (["bash", "sh", "zsh"].includes(program) && flag === "-c") {
    return shellGithubCalls(script);
  }
  return [];
}
function substitutedCalls(word: string): string[][] {
  if (!word.includes('"')) return [];
  return [...word.matchAll(/\$\((?<script>[^()]*)\)/g)].flatMap((match) =>
    shellGithubCalls(groupValue(match, "script")),
  );
}
export function shellGithubCalls(command: string): string[][] {
  const calls: string[][] = [];
  let words: string[] = [];
  for (const [token] of command.replace(/\\\n/g, "").matchAll(shellWords)) {
    if (/^[\n;&|()`]$/.test(token)) {
      calls.push(...githubArgs(words));
      words = [];
    } else {
      calls.push(...substitutedCalls(token));
      words.push(token.replace(/['"]/g, ""));
    }
  }
  return [...calls, ...githubArgs(words)];
}
