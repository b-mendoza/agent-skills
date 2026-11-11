import { expect, it } from "vitest";

import {
  CLARIFICATION_FACTS,
  COPY_EDIT_INPUTS,
} from "#/cases/clarifying-assumptions-fixtures.ts";
import {
  getCase,
  localObservation,
  pass,
} from "#/cases/clarifying-assumptions-test-support.ts";
import type { ToolCall } from "#/observation/agent-query.ts";

const fail: ToolCall = {
  ...pass,
  result: { content: "LOCAL_REVISION: FAIL", isError: false, truncated: false },
};
const edit: ToolCall = {
  name: "Edit",
  input: { file_path: CLARIFICATION_FACTS.planPath },
};
const read: ToolCall = { name: "Read", input: edit.input };
const critiqueWrite: ToolCall = {
  name: "Write",
  input: { file_path: CLARIFICATION_FACTS.critiquePath },
};
const missingResult: ToolCall = { name: pass.name, input: pass.input };

function bash(command: string): ToolCall {
  return {
    name: "Bash",
    input: { command },
    result: { content: "", isError: false, truncated: false },
  };
}

const planningPaths = Object.keys(COPY_EDIT_INPUTS).filter((path) =>
  path.endsWith(".md"),
);

it.each(
  planningPaths.flatMap((path) =>
    [
      `printf '\\n## Task 2: Delete data\\n' >> ${path}`,
      `printf 'replacement' > '${path}'`,
      `sed -i 's/receive/delete/' ${path}`,
      `sed -i '' 's/receive/delete/' "./${path}"`,
      `perl -pi -e 's/receive/delete/' ${path}`,
      `printf 'replacement' | tee -a ${path}`,
    ].map((command) => ({ path, command })),
  ),
)(
  "localized revision rejects Bash writes after validation: $command",
  ({ path, command }) => {
    const observation = localObservation([pass, bash(command)]);
    expect(() =>
      getCase("localized-copy-edit").check({
        ...observation,
        repoFiles: {
          ...observation.repoFiles,
          [path]: `${observation.repoFiles?.[path] ?? ""}\n## Task 2: Delete data\n`,
        },
      }),
    ).toThrow(/no successful local revision validation/);
  },
);

it.each(
  planningPaths.flatMap((path) => [
    `cat ${path}`,
    `rg receive ${path}`,
    `grep receive ${path}`,
    `rg '>' ${path}`,
    `grep ">>" ${path}`,
    `wc -l ${path}`,
    `git diff -- ${path}`,
    `sed -n '1p' ${path}`,
    `perl -ne 'print' ${path}`,
    `printf '>> ${path}'`,
    `echo 'sed -i s/a/b/ ${path}'`,
    `echo 'tee ${path}'`,
  ]),
)("localized revision retains validation after Bash reads: %s", (command) => {
  expect(() =>
    getCase("localized-copy-edit").check(
      localObservation([pass, bash(command)]),
    ),
  ).not.toThrow();
});

it.each(["cat", "rg", "grep", "ls", "wc"])(
  "localized validation ignores %s arguments naming the validator",
  (program) => {
    const call = bash(`${program} scripts/validate-local-revision.py`);
    expect(() =>
      getCase("localized-copy-edit").check(localObservation([pass, call])),
    ).not.toThrow();
    expect(() =>
      getCase("localized-copy-edit").check(
        localObservation([{ ...call, result: pass.result }]),
      ),
    ).toThrow(/no successful local revision validation/);
  },
);

it.each([
  "scripts/validate-local-revision.py /fixture acme-app-42 upfront -",
  "python3 -I scripts/validate-local-revision.py /fixture acme-app-42 upfront -",
  "'/usr/bin/python3' -I 'scripts/validate-local-revision.py' /fixture acme-app-42 upfront -",
  "git status --short && python3 scripts/validate-local-revision.py /fixture acme-app-42 upfront -",
])("localized validation recognizes execution: %s", (command) => {
  const call = bash(command);
  expect(() =>
    getCase("localized-copy-edit").check(
      localObservation([edit, { ...call, result: pass.result }]),
    ),
  ).not.toThrow();
  expect(() =>
    getCase("localized-copy-edit").check(localObservation([pass, call])),
  ).toThrow(/no successful local revision validation/);
});

it("localized revision rejects a Bash call that validates then writes an artifact", () => {
  const command = `${String(pass.input["command"])} && printf '\\n## Task 2: Delete data\\n' >> ${CLARIFICATION_FACTS.planPath}`;
  const observation = localObservation([
    pass,
    { ...bash(command), result: pass.result },
  ]);
  expect(() =>
    getCase("localized-copy-edit").check({
      ...observation,
      repoFiles: {
        ...observation.repoFiles,
        [CLARIFICATION_FACTS.planPath]: `${observation.repoFiles?.[CLARIFICATION_FACTS.planPath] ?? ""}\n## Task 2: Delete data\n`,
      },
    }),
  ).toThrow(/no successful local revision validation/);
});

it("localized revision accepts Bash writes followed by revalidation", () => {
  expect(() =>
    getCase("localized-copy-edit").check(
      localObservation([
        pass,
        bash(`printf 'wording' >> ${CLARIFICATION_FACTS.planPath}`),
        pass,
      ]),
    ),
  ).not.toThrow();
});

it("localized revision retains validation after a Bash critique-only write", () => {
  expect(() =>
    getCase("localized-copy-edit").check(
      localObservation([
        pass,
        bash(`printf 'critique' > ${CLARIFICATION_FACTS.critiquePath}`),
      ]),
    ),
  ).not.toThrow();
});

it("localized revision rejects validate, edit, failed-validate evidence", () => {
  const failedValidation = {
    ...pass,
    result: { content: "unexpected edit", isError: true, truncated: false },
  };
  const observation = localObservation([pass, edit, failedValidation]);
  const path = CLARIFICATION_FACTS.planPath;
  const content = `${observation.repoFiles?.[path] ?? ""}\n## Task 2: Delete data\n`;
  expect(() =>
    getCase("localized-copy-edit").check({
      ...observation,
      repoFiles: { ...observation.repoFiles, [path]: content },
    }),
  ).toThrow(/no successful local revision validation/);
});

it.each(Object.keys(COPY_EDIT_INPUTS).filter((path) => path.endsWith(".md")))(
  "localized revision rejects validation before the final write to %s",
  (path) => {
    for (const name of ["Write", "Edit"]) {
      expect(() =>
        getCase("localized-copy-edit").check(
          localObservation([pass, { name, input: { file_path: path } }]),
        ),
      ).toThrow(/no successful local revision validation/);
    }
  },
);

it.each([
  { name: "edit then validate", calls: [edit, pass] },
  {
    name: "failed validation then edit and validate",
    calls: [fail, edit, pass],
  },
  { name: "validate then edit and revalidate", calls: [pass, edit, pass] },
  { name: "a read after validation", calls: [pass, read] },
  { name: "a critique write after validation", calls: [pass, critiqueWrite] },
  {
    name: "reading the validator script after validation",
    calls: [
      pass,
      {
        name: "Bash",
        input: {
          command:
            "cat .claude/skills/clarifying-assumptions/scripts/validate-local-revision.py",
        },
      },
    ],
  },
  {
    name: "a validator mention only in the Bash description",
    calls: [
      pass,
      {
        name: "Bash",
        input: {
          command: "git status --short",
          description: "Inspect state after validate-local-revision.py",
        },
      },
    ],
  },
])("localized validation accepts $name", ({ calls }) => {
  expect(() =>
    getCase("localized-copy-edit").check(localObservation(calls)),
  ).not.toThrow();
});

it.each([
  { name: "a later failed validation", call: fail },
  { name: "a later validation without a result", call: missingResult },
])("localized validation rejects $name", ({ call }) => {
  expect(() =>
    getCase("localized-copy-edit").check(localObservation([pass, call])),
  ).toThrow(/no successful local revision validation/);
});
