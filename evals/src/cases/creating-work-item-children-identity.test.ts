import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SUCCESS = 0;
const FAILURE = 1;
const USAGE_ERROR = 2;

const script = fileURLToPath(
  new URL(
    "../../../skills/creating-work-item-children/scripts/validate-identity.py",
    import.meta.url,
  ),
);
const canonicalParent = "https://github.com/acme/app/issues/42";
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
function validate(childTask: unknown, parent = canonicalParent) {
  return spawnSync("python3", ["-I", script], {
    input: JSON.stringify({
      parent: canonicalParent,
      task,
      child: { parent, task: childTask },
    }),
    encoding: "utf8",
  });
}

describe("child task content identity", () => {
  it("rejects arguments with usage exit", () => {
    const result = spawnSync("python3", ["-I", script, "-h"], {
      encoding: "utf8",
    });
    expect(result.status).toBe(USAGE_ERROR);
    expect(result.stdout).toContain("Usage: python3 -I validate-identity.py");
  });
  it("accepts a child whose parent and content match the plan", () => {
    const result = validate(task);
    expect(result.status).toBe(SUCCESS);
    expect(result.stdout).toMatch(/^IDENTITY: PASS\n$/);
  });
  it.each([
    {
      label: "changed implementation",
      childTask: { ...task, implementation: "Disable filtering." },
    },
    { label: "missing identity fields", childTask: { title: task.title } },
    { label: "empty acceptance evidence", childTask: { ...task, done: "" } },
  ])("rejects $label with the same parent", ({ childTask }) => {
    expect(validate(childTask).status).toBe(FAILURE);
  });
  it("rejects a child from another parent", () => {
    expect(validate(task, "https://github.com/acme/app/issues/99").status).toBe(
      FAILURE,
    );
  });
});
