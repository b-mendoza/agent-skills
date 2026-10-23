import type {
  ApiProvider,
  CallApiContextParams,
  ProviderResponse,
} from "promptfoo";

import { SKILL } from "#/cases/analyzing-recent-project-state.ts";
import { makeFixture } from "#/fixtures/fixtures.ts";
import { observeClaude } from "#/observation/agent-query.ts";
import { toText } from "#/observation/git-status.ts";

import { evalModel } from "../../promptfooconfig.ts";
import { getCase } from "./observation.ts";

const FIRST_REPEAT = 0;

async function runCase(
  context: CallApiContextParams,
): Promise<ProviderResponse> {
  const evalCase = getCase(context.vars["caseId"]);
  const fixture = makeFixture(evalCase.fixture, SKILL);
  try {
    const observation = await observeClaude({
      cwd: fixture.cwd,
      gitRepo: fixture.gitRepo ?? fixture.cwd,
      prompt: evalCase.prompt({
        missingPath: fixture.missingPath,
        notGitPath: fixture.notGitPath,
      }),
      budgetUsd: evalCase.budgetUsd,
      model: evalModel,
      wallClockMs: evalCase.wallClockMs,
    });
    return {
      output: observation.finalText,
      cost: observation.costUsd,
      metadata: {
        observation,
        repeatIndex: context.repeatIndex ?? FIRST_REPEAT,
      },
    };
  } finally {
    fixture.cleanup();
  }
}

function errorResponse(error: unknown): ProviderResponse {
  return { error: error instanceof Error ? error.message : toText(error) };
}

export default class EvalProvider implements ApiProvider {
  private readonly providerId = "agent-skills";
  // The runner owns one invocation; promptfoo owns repetitions, not retries.
  readonly handlesOwnRetries = true;
  id = (): string => this.providerId;

  callApi: ApiProvider["callApi"] = async (_prompt, context) => {
    try {
      if (context === undefined) {
        throw new Error(`Missing ${this.id()} context`);
      }
      return await runCase(context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
