// Only facts needed to address a reply to the displayed card. Disclosure quality
// belongs to the judge; mutation scope is checked from tool/Git evidence.
export interface CardFacts {
  readonly version: string;
  readonly decisionIds: readonly string[];
}

const FULL_MATCH = 0;

function versionId(text: string): string | undefined {
  const labeled =
    /\b(?:card(?:\s+version)?|version)[\s:|=—-]*(?<version>v[1-9]\d*)\b/i.exec(
      text,
    );
  if (labeled !== null) return labeled.groups?.["version"];
  return /\bv[1-9]\d*\b/i.exec(text)?.[FULL_MATCH];
}

export function cardFacts(text: string): CardFacts | undefined {
  const clean = text.replace(/[*`]/g, "");
  const version = versionId(clean);
  if (version === undefined) return undefined;
  const decisionIds = [
    ...new Set(
      [...clean.matchAll(/\bD-[a-z][a-z0-9-]*\b/gi)].map((entry) =>
        entry[FULL_MATCH].toLowerCase().replace(/^d-/, "D-"),
      ),
    ),
  ];
  return { version: version.toLowerCase(), decisionIds };
}
