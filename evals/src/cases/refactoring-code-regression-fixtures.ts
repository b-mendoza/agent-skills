import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SeedContext } from "#/cases/case-contract.ts";
import { seedFixtureRoot } from "#/cases/shared-checks.ts";
import { commitRepoFiles, copyHeadReflog } from "#/fixtures/fixtures.ts";

export const HANDOFFS = ".handoffs/refactoring-code/";
export const SENTINEL = `${HANDOFFS}other-run/sentinel.txt`;
export const SIMPLE_SOURCE = `export function price(value, member) {
  if (member) {
    return value;
  } else {
    return value;
  }
}
`;
export const SIMPLE_FILES = {
  "src/a.js": SIMPLE_SOURCE,
  "src/b.js": SIMPLE_SOURCE,
  "a.test.js": `import { price } from './src/a.js';
import assert from 'node:assert/strict';
import test from 'node:test';
test('unique boundary', () => assert.equal(price(0, true), 0));
`,
  "package.json": '{"type":"module"}\n',
  "scripts/check.mjs": `import { writeFileSync } from 'node:fs';
writeFileSync('validation-ran.txt', 'ran');
console.log('tests 1 pass 1');
`,
} as const;

function seedRun(repoPath: string): void {
  seedFixtureRoot(repoPath);
  appendFileSync(join(repoPath, ".git/info/exclude"), "\n.handoffs/\n");
}

export function seedSimple({ repoPath }: SeedContext): void {
  seedRun(repoPath);
  commitRepoFiles(repoPath, SIMPLE_FILES, "seed refactor gates");
  copyHeadReflog(repoPath);
  mkdirSync(join(repoPath, HANDOFFS, "other-run"), { recursive: true });
  writeFileSync(join(repoPath, SENTINEL), "another run owns this\n");
}

export const OVERSIZED_SOURCE = Array.from(
  { length: 24 },
  (_, index) =>
    `export function value${String(index)}(n) {\n  if (n < 0) {\n    return 0;\n  } else {\n    return n;\n  }\n}\n`,
).join("\n");
export const BOUNDARY_FILES = {
  "src/oversized.js": OVERSIZED_SOURCE,
  "src/caller.js": "export const publicCaller = true;\n",
  "boundary.json": '{"forbidden":["src/oversized.js"]}\n',
  "package.json": '{"type":"module"}\n',
  "boundary.test.js": `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as api from './src/oversized.js';
test('all original public wrappers preserve behavior', () => {
  for (let i = 0; i < 24; i += 1) {
    assert.equal(api['value' + i](-1), 0);
    assert.equal(api['value' + i](2), 2);
  }
});
const { forbidden } = JSON.parse(readFileSync('boundary.json', 'utf8'));
const allowed = (caller, target) => !(caller === 'src/caller.js' && forbidden.includes(target));
for (const target of ['src/oversized.js', 'src/core.js']) {
  test('restricted caller cannot import ' + target, () => assert.equal(allowed('src/caller.js', target), false));
  test('trusted caller can import ' + target, () => assert.equal(allowed('src/trusted.js', target), true));
}
`,
} as const;

export function seedBoundary({ repoPath }: SeedContext): void {
  seedRun(repoPath);
  commitRepoFiles(repoPath, BOUNDARY_FILES, "seed oversized boundary target");
  copyHeadReflog(repoPath);
}

const DUPLICATE_HELPERS = Array.from(
  { length: 20 },
  (_, index) =>
    `function duplicate${String(index)}(n) { return Math.round(n * 100) / 100; }\n`,
);
export const ANALYSIS_SOURCE = [
  ...DUPLICATE_HELPERS,
  "function criticalTail(n) { return Math.round(n * 100) / 100; }\n",
].join("");
export const ANALYSIS_FILES = {
  "src/analyze.js": ANALYSIS_SOURCE,
  "src/money.js":
    "export function roundMoney(n) { return Math.round(n * 100) / 100; }\n",
  "history.txt": "Consult the previous revision for historical risk.\n",
};

export function seedAnalysis({ repoPath }: SeedContext): void {
  seedRun(repoPath);
  commitRepoFiles(
    repoPath,
    {
      ...ANALYSIS_FILES,
      "history.txt":
        "Prioritize criticalTail: unlike duplicates, its earlier caller was a public entry point.\n",
    },
    "record tail priority",
  );
  writeFileSync(join(repoPath, "history.txt"), ANALYSIS_FILES["history.txt"]);
  execFileSync("git", ["add", "history.txt"], { cwd: repoPath });
  execFileSync("git", ["commit", "-qm", "move priority clue into history"], {
    cwd: repoPath,
  });
  copyHeadReflog(repoPath);
}
