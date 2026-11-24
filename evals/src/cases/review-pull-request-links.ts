import { visibleTurn } from "#/cases/review-pull-request-visible-preview.ts";

function fenceMarker(line: string): string {
  const [marker = ""] = /^ {0,3}(?:`{3,}|~{3,})/u.exec(line) ?? [];
  return marker.trim();
}

function outsideFence() {
  let fence = "";
  return (line: string): boolean => {
    if (fence !== "") {
      if (line.trim().startsWith(fence)) fence = "";
      return false;
    }
    fence = fenceMarker(line);
    return fence === "";
  };
}

function proseLines(body: string): string[] {
  return visibleTurn(body)
    .split("\n")
    .filter(outsideFence())
    .filter((line) => !/^(?: {4}|\t)/u.test(line));
}

function destination(text: string): string {
  const [url = ""] = text.trim().split(/\s+/u);
  return url.replace(/^<|>$/gu, "");
}

function collectDefinition(
  line: string,
  definitions: Map<string, string>,
): boolean {
  const match = /^ {0,3}\[(?<key>[^[\]\n]+)\]:[ \t]*(?<value>\S.*)$/u.exec(
    line,
  )?.groups;
  if (match === undefined) return false;
  definitions.set(
    String(match["key"]).toLowerCase(),
    destination(String(match["value"])),
  );
  return true;
}

function referenceLabel(key: string | undefined, label: string): string {
  return key === "" ? label : (key ?? label);
}

const TAG = /<\/?[a-z][\w-]*(?:\s[^<>]*)?\/?>/giu;
function htmlLinks(text: string, urls: Set<string>): string {
  return text
    .replace(/<(?<tag>pre|code)\b[^>]*>[\s\S]*?<\/\k<tag>>/giu, " ")
    .replace(
      /<a\s(?<attrs>[^<>]*)>(?<label>[\s\S]*?)<\/a>/giu,
      (_match: string, attrs: string, label: string) => {
        if (label.replace(TAG, "").trim() !== "") urls.add(href(attrs));
        return " ";
      },
    )
    .replace(TAG, " ");
}

function href(attributes: string): string {
  const value =
    /(?:^|\s)href\s*=\s*(?<url>"[^"]*"|'[^']*'|[^\s>]+)/iu.exec(attributes)
      ?.groups?.["url"] ?? "";
  return value.replace(/^["']|["']$/gu, "");
}

/** Inspect link destinations, never image URLs, unused definitions or code examples. */
export function hasLink(body: string, expected: string): boolean {
  const definitions = new Map<string, string>();
  const visible = proseLines(body)
    .filter((line) => !collectDefinition(line, definitions))
    .join("\n")
    .replace(/(?<ticks>`+)[\s\S]*?\k<ticks>/gu, " ");
  const urls = new Set<string>();
  const inline = /(?<image>!?)\[(?<label>[^[\]\n]*)\]\((?<dest>[^()\n]*)\)/gu;
  const bare = htmlLinks(visible, urls)
    .replace(
      inline,
      (_match: string, image: string, label: string, dest: string) => {
        if (image === "" && label.trim() !== "") urls.add(destination(dest));
        return " ";
      },
    )
    .replace(
      /(?<image>!?)\[(?<label>[^[\]\n]+)\](?:\[(?<key>[^[\]\n]*)\])?/gu,
      (_match: string, image: string, label: string, key?: string) => {
        const ref = referenceLabel(key, label);
        if (image === "" && label.trim() !== "") {
          urls.add(definitions.get(ref.toLowerCase()) ?? "");
        }
        return " ";
      },
    );
  const bareUrls = bare.match(/https?:\/\/[^\s<>()\]`]+/gu) ?? [];
  return (
    urls.has(expected) ||
    bareUrls.some(
      (url) =>
        url.startsWith(expected) &&
        /^[.,;:!?]*$/u.test(url.slice(expected.length)),
    )
  );
}
