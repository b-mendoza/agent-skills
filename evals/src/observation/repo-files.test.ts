import { Schema } from "effect";
import { expect, test } from "vitest";

import { observationSchema } from "#/observation/agent-query.ts";
import { createObservation } from "#/observation/observation-test-support.ts";

test("observation metadata validates snapshot contents", () => {
  const decode = Schema.decodeUnknownSync(observationSchema);
  expect(
    decode(createObservation({ repoFiles: { "report.md": "ok", gone: null } }))
      .repoFiles,
  ).toEqual({ "report.md": "ok", gone: null });
  expect(() =>
    decode({ ...createObservation(), repoFiles: { "report.md": 123 } }),
  ).toThrow();
});
