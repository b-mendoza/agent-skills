import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SUCCESS = 0;
const FAILURE = 1;

const script = fileURLToPath(
  new URL(
    "../../../skills/creating-work-item-children/scripts/validate-identity.py",
    import.meta.url,
  ),
);
const task = {
  title: "Preserve empty export header",
  objective: "Keep the header for empty exports.",
  requirements: "CSV only.",
  dependencies: "None",
  questions: "None - all resolved.",
  implementation: "Keep the header; preserve filtering.",
  done: "Empty exports contain the header.",
  artifacts: "CSV exporter and tests.",
};
function validate(
  childTask: unknown,
  parent = "https://github.com/acme/app/issues/42",
) {
  return spawnSync("python3", ["-I", script], {
    input: JSON.stringify({
      parent: "https://github.com/acme/app/issues/42",
      task,
      child: { parent, task: childTask },
    }),
    encoding: "utf8",
  });
}

describe("child task content identity", () => {
  it("accepts complete matching content independently of mutable task numbering", () => {
    const result = validate(task);
    expect(result.status).toBe(SUCCESS);
    expect(result.stdout).toMatch(/^IDENTITY: PASS sha256=[a-f0-9]{64}\n$/);
  });
  it.each([
    [
      "renumbered stale scope",
      { ...task, objective: "Delete the CSV exporter." },
    ],
    [
      "same title but different implementation",
      { ...task, implementation: "Disable filtering." },
    ],
    ["unproven legacy body", { title: task.title }],
    ["missing acceptance evidence", { ...task, done: "" }],
  ])("rejects %s even with the same parent and index", (_name, childTask) => {
    expect(validate(childTask).status).toBe(FAILURE);
  });
  it("rejects a different parent", () => {
    expect(validate(task, "https://github.com/acme/app/issues/99").status).toBe(
      FAILURE,
    );
  });
});
