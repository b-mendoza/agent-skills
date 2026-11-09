import { COMMIT_SCOPE } from "#/cases/committing-scoped-changes-fixtures.ts";
import type { PlanFacts } from "#/cases/committing-scoped-changes-plan-evidence.ts";

interface PreviewGroup {
  readonly number: number;
  readonly message?: string;
  readonly paths?: string;
  readonly verification?: string;
}
type FieldName = "message" | "paths" | "verification";
interface PreviewField {
  readonly name: FieldName;
  readonly value: string;
}
const FIELD_NAMES: Readonly<Record<string, FieldName | undefined>> = {
  message: "message",
  paths: "paths",
  files: "paths",
  verification: "verification",
};
const FIRST_GROUP = 1;
const NO_GROUPS = 0;
const LAST_INDEX = -1;
const AFTER_COLON = 1;

function plainLine(line: string): string {
  return line
    .replaceAll(/[*`]/g, "")
    .trim()
    .replace(/^[-+]\s+/, "");
}
function isPlaceholder(value: string): boolean {
  return /^(?:none|tbd|todo|pending|unknown|unavailable|not ready|to be determined)\b/i.test(
    value,
  );
}
function hasVerification(group: PreviewGroup): boolean {
  const command = group.verification;
  if (command === undefined) return false;
  if (command === "none") return true;
  // These fixture repos configure this script, not an arbitrary prose plan.
  return /^sh (?:\.\/)?check\.sh (?:format|behavior)(?:\s*&&\s*sh (?:\.\/)?check\.sh (?:format|behavior))*$/.test(
    command,
  );
}
function isCompleteGroup(group: PreviewGroup): boolean {
  if (group.message === undefined || isPlaceholder(group.message)) return false;
  return group.paths !== undefined && hasVerification(group);
}
function parseHeader(line: string): number | undefined {
  const match = /^#{0,6}\s*(?:group|commit)\s+(?<number>\d+)\b/i.exec(line);
  if (match !== null) return Number(match.groups?.["number"]);
  return reversedHeader(line);
}
function reversedHeader(line: string): number | undefined {
  const reversed = /^#{0,6}\s*(?<number>\d+)\.\s+(?:group|commit)\b/i.exec(
    line,
  );
  if (reversed === null) return undefined;
  return Number(reversed.groups?.["number"]);
}
function parseField(line: string): PreviewField | undefined {
  const colon = line.indexOf(":");
  const name = FIELD_NAMES[line.slice(NO_GROUPS, colon).toLowerCase()];
  if (name === undefined) return undefined;
  const value = line.slice(colon + AFTER_COLON).trim();
  if (value === "") return undefined;
  return {
    name,
    value: name === "verification" ? normalizedVerification(value) : value,
  };
}
function normalizedVerification(value: string): string {
  return /^none\b/i.test(value) ? "none" : value;
}
function updateLast(
  groups: readonly PreviewGroup[],
  field: PreviewField,
): PreviewGroup[] | undefined {
  const current = groups.at(LAST_INDEX);
  if (current === undefined) return undefined;
  if (current[field.name] !== undefined) {
    return repeatedVerification(groups, current, field);
  }
  return [
    ...groups.slice(NO_GROUPS, LAST_INDEX),
    { ...current, [field.name]: field.value },
  ];
}
function repeatedVerification(
  groups: readonly PreviewGroup[],
  group: PreviewGroup,
  field: PreviewField,
): PreviewGroup[] | undefined {
  if (field.name !== "verification") return undefined;
  const underlying = /\bnone (?:will run|ran)\b/i.test(field.value)
    ? "none"
    : field.value;
  if (group.verification !== underlying) return undefined;
  return [...groups];
}
function appendLine(
  groups: PreviewGroup[],
  line: string,
): PreviewGroup[] | undefined {
  const number = parseHeader(line);
  if (number !== undefined) return [...groups, { number }];
  const field = parseField(line);
  if (field === undefined) return groups;
  return updateLast(groups, field);
}
function parseGroups(lines: readonly string[]): PreviewGroup[] | undefined {
  let groups: PreviewGroup[] | undefined = [];
  for (const line of lines) {
    if (groups === undefined) return undefined;
    groups = appendLine(groups, line);
  }
  return groups;
}
function coversScope(groups: readonly PreviewGroup[]): boolean {
  const paths = groups.flatMap((group) => (group.paths ?? "").split(/[\s,]+/));
  if (paths.length !== COMMIT_SCOPE.length) return false;
  return COMMIT_SCOPE.every((path) => paths.includes(path));
}
function tableCells(line: string): string[] {
  return line
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell !== "");
}
function tableValue(
  headers: readonly string[],
  cells: readonly string[],
  field: string,
): string {
  const index = headers.indexOf(field);
  return index === LAST_INDEX ? "" : (cells.at(index) ?? "");
}
function tableGroup(
  headers: readonly string[],
  cells: readonly string[],
  index: number,
): PreviewGroup {
  return {
    number: index + FIRST_GROUP,
    message: tableValue(headers, cells, "message"),
    paths: tableValue(headers, cells, "paths"),
    verification: normalizedVerification(
      tableValue(headers, cells, "verification"),
    ),
  };
}
function tableGroups(lines: readonly string[]): PreviewGroup[] | undefined {
  const rows = lines.filter((line) => line.startsWith("|")).map(tableCells);
  const headerIndex = rows.findIndex((cells) =>
    cells.some((cell) => cell.toLowerCase() === "message"),
  );
  const headers = rows
    .at(headerIndex)
    ?.map((cell) => cell.toLowerCase().replace("files", "paths"));
  if (headers === undefined || headerIndex === LAST_INDEX) return undefined;
  const data = rows
    .slice(headerIndex + FIRST_GROUP)
    .filter((cells) => !cells.every((cell) => /^[-: ]+$/.test(cell)));
  return data.map((cells, index) => tableGroup(headers, cells, index));
}
function hasRefusal(lines: readonly string[]): boolean {
  return lines.some((line) =>
    /\b(?:I|we)\s+(?:cannot|can.t|am unable|are unable|am not ready|are not ready)\b/i.test(
      line,
    ),
  );
}
function completeGroups(groups: readonly PreviewGroup[]): boolean {
  const complete = groups.every(
    (group, index) =>
      group.number === index + FIRST_GROUP && isCompleteGroup(group),
  );
  return groups.length > NO_GROUPS && complete && coversScope(groups);
}
function completePreview(
  groups: PreviewGroup[] | undefined,
): PreviewGroup[] | undefined {
  if (groups === undefined || !completeGroups(groups)) return undefined;
  return groups;
}
function groupsForApproval(text: string): PreviewGroup[] | undefined {
  const lines = text.split("\n").map(plainLine);
  if (hasRefusal(lines)) return undefined;
  return (
    completePreview(parseGroups(lines)) ?? completePreview(tableGroups(lines))
  );
}
export function markdownPlanGroups(text: string): PlanFacts[] | undefined {
  return groupsForApproval(text)?.map((group) => ({
    message: group.message ?? "",
    paths: (group.paths ?? "").split(/[\s,]+/),
    verification: group.verification ?? "",
  }));
}
