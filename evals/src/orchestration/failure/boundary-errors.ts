// Unwraps the tagged errors that the runner and case-execution boundaries nest
// around an original failure, down to a printable message.

import { ObservationRunError } from "#/orchestration/case-execution/agent-observation.ts";
import type { CaseExecutionError } from "#/orchestration/case-execution/execution.ts";
import {
  CaseFixtureAcquisitionError,
  CaseFixtureCleanupError,
  PromptConstructionError,
} from "#/orchestration/case-execution/execution.ts";
import {
  RunnerCaseExecutionError,
  RunnerOutputError,
  RunnerReportWriteError,
} from "#/orchestration/suite/services.ts";

type RunnerBoundaryError =
  | RunnerCaseExecutionError
  | RunnerReportWriteError
  | RunnerOutputError;

function isRunnerBoundaryError(error: unknown): error is RunnerBoundaryError {
  return (
    error instanceof RunnerCaseExecutionError ||
    error instanceof RunnerReportWriteError ||
    error instanceof RunnerOutputError
  );
}

function isCaseExecutionError(error: unknown): error is CaseExecutionError {
  return (
    error instanceof CaseFixtureAcquisitionError ||
    error instanceof CaseFixtureCleanupError ||
    error instanceof PromptConstructionError ||
    error instanceof ObservationRunError
  );
}

function isWrappedBoundaryError(
  error: unknown,
): error is CaseExecutionError | RunnerBoundaryError {
  return isRunnerBoundaryError(error) || isCaseExecutionError(error);
}

// The live path nests a CaseExecutionError inside a RunnerCaseExecutionError,
// so unwrapping has to recurse to reach the original failure.
function unwrapBoundaryCause(error: unknown): unknown {
  return isWrappedBoundaryError(error)
    ? unwrapBoundaryCause(error.cause)
    : error;
}

export function describeSuiteFailure(error: unknown): string {
  const originalCause = unwrapBoundaryCause(error);
  return originalCause instanceof Error
    ? originalCause.message
    : String(originalCause);
}
