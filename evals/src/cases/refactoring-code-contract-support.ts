import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const FIRST = 0;
const ONE = 1;

export const SCRIPT = fileURLToPath(
  new URL(
    "../../../skills/refactoring-code/scripts/validate-report.py",
    import.meta.url,
  ),
);

export function analysisReport() {
  return {
    version: 1,
    from: "chunk-analyst",
    chunk: "duplication-reuse",
    status: "PASS",
    total_findings: 21,
    omitted_count: 9,
    omitted_high_priority: 0,
    omitted_categories: ["normal duplicate helpers 11 through 19 deferred"],
    findings: Array.from({ length: 12 }, (_, index) => ({
      location: `src/analyze.js:${String(index + ONE)}`,
      problem:
        index === FIRST
          ? "criticalTail duplicates rounding"
          : "duplicate helper",
      transformation: "reuse existing helper",
      reuse_rung: "reuse-repo",
      reuse_evidence: "src/money.js:roundMoney",
      net_lines: -1,
      priority: index === FIRST ? "high" : "normal",
      confidence: "high",
    })),
  };
}

export function checkReport(
  payload: string,
  role = "chunk-analyst",
  outsideRun = false,
) {
  const root = mkdtempSync(join(tmpdir(), "refactor-contract-"));
  const run = join(root, ".handoffs/refactoring-code/run-one");
  mkdirSync(run, { recursive: true });
  const report = join(outsideRun ? root : run, "report.json");
  writeFileSync(report, payload);
  try {
    return spawnSync("python3", ["-I", SCRIPT, "report", role, report, run], {
      encoding: "utf8",
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

export const ROLE_REPORTS = [
  {
    role: "behavior-mapper",
    prefix: "BEHAVIOR_MAP",
    required: "Proposed chunks",
    text: `BEHAVIOR_MAP: PASS
Target: src/a.js
Files inspected: src/a.js
Worktree baseline:
- Commit: abc123
- Porcelain summary: clean
- Pre-existing dirty files: none
Current behavior facts:
- returns input
Validation candidates:
- User command: node --test
- Discovered candidates: none
File sizes:
- src/a.js: 7/250 OK
Proposed chunks:
- duplication: repeated branches
- complexity: nested paths
Risk notes: none`,
  },
  {
    role: "refactor-implementer",
    prefix: "IMPLEMENTATION",
    required: "Validation evidence",
    text: `IMPLEMENTATION: PASS
Fix cycle: none
Changes made:
- src/a.js: simplify branches
Per-file disposition:
- src/a.js: edited-from-clean
File sizes after change:
- src/a.js: 3/250 compliant
Net lines: -4
Baseline checkpoint: pass
Validation evidence:
- Command: node --test
- Safety class: safe
- Exit code: 0
- Coverage evidence: 1 test
- Result: pass
Warnings:
- none
Deviations:
- none
Reviewer focus:
- src/a.js
Risk notes: none`,
  },
  {
    role: "refactor-reviewer",
    prefix: "REFACTOR_REVIEW",
    required: "Behavior verdict",
    text: `REFACTOR_REVIEW: PASS
Fix cycle reviewed: 0 of 2
Behavior verdict: pass
Simplification verdict: pass
Baseline scope check:
- Implementer-reported files reviewed: src/a.js
- Files changed outside report: none
Plan conformance:
- pass
Behavior and protected-boundary check:
- pass
Simplification outcome:
- Net lines: -4
- Duplication: removed
- Reuse rungs: honored
Size policy check:
- pass
Validation evidence check:
- pass; node --test; exit 0; 1 test
Findings:
- none
Required fixes:
- none
Minor notes for handoff:
- none
Risk notes:
- none`,
  },
] as const;
