import { expect, it } from "vitest";

import { assertSummaryDuplicate } from "#/cases/review-pull-request-checks.ts";
import { FEEDBACK_URL } from "#/cases/review-pull-request-fixtures.ts";

it.each([
  "[](<URL>)",
  "\n[unused]: URL",
  "![discussion](URL)",
  "<img src=URL>",
  "<pre>URL</pre>",
  "<a href=URL></a>",
  "\n\n    URL",
])("rejects non-link Markdown %s", (text) => {
  const report =
    `## Findings\n\nID: X\nPlacement: summary\n\n## Review summary\n\nSee ${FEEDBACK_URL.review}.`.replace(
      `See ${FEEDBACK_URL.review}.`,
      text.replace("URL", FEEDBACK_URL.review),
    );
  expect(() => {
    assertSummaryDuplicate(report, FEEDBACK_URL.review);
  }).toThrow(/feedback link/);
});
