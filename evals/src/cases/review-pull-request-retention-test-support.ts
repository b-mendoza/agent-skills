import { createHash } from "node:crypto";

import { APPROVAL_CHECKPOINT } from "#/cases/review-pull-request-retention-checkpoint.ts";

export const REVIEW_RUN = ".handoffs/review-pull-request/run";
export const RETAINED_PAYLOADS = {
  ".handoffs/review-pull-request/": "",
  [`${REVIEW_RUN}/context.txt`]:
    'CONTEXT: PASS\n{"dimensions":[{"name":"correctness"},{"name":"tests"}]}',
  [`${REVIEW_RUN}/chunk-correctness.txt`]: "CHUNK: PASS\n{}",
  [`${REVIEW_RUN}/chunk-tests.txt`]: "CHUNK: PASS\n{}",
  [`${REVIEW_RUN}/author.txt`]: "AUTHOR: PASS\n{}",
  [`${REVIEW_RUN}/verify.txt`]: "VERIFY: PASS\n{}",
};

export function approvalCheckpoint(
  files: Readonly<Record<string, string | null>> = {},
): Record<string, string> {
  const entries = Object.entries(files).filter(
    ([path, bytes]) =>
      path.startsWith(".handoffs/") &&
      !path.endsWith("/") &&
      typeof bytes === "string",
  );
  return {
    [APPROVAL_CHECKPOINT]: JSON.stringify(
      Object.fromEntries(
        entries.map(([path, bytes]) => [
          path,
          createHash("sha256").update(String(bytes)).digest("hex"),
        ]),
      ),
    ),
  };
}
