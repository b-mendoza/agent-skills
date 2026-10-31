import type {
  ApiProvider,
  CallApiContextParams,
  ProviderResponse,
} from "promptfoo";

import { makeFixture } from "#/fixtures/fixtures.ts";
import type { Observation } from "#/observation/agent-query.ts";
import { observeClaude } from "#/observation/agent-query.ts";
import { toText } from "#/observation/mutation-evidence.ts";
import { snapshotRepoFiles } from "#/observation/repo-files.ts";

import { evalModel } from "../../promptfooconfig.ts";
import { getCase } from "./observation.ts";

const FIRST_REPEAT = 0;

async function runCase(
  context: CallApiContextParams,
): Promise<ProviderResponse> {
  const evalCase = getCase(context.vars["caseId"]);
  const fixture = makeFixture(
    evalCase.fixture,
    [evalCase.skill, ...(evalCase.extraSkills ?? [])],
    evalCase.seed,
  );
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
      pathPrefix: fixture.binPath,
    });
    return snapshotResponse(
      observation,
      fixture.cwd,
      evalCase.snapshotPaths,
      context.repeatIndex ?? FIRST_REPEAT,
    );
  } finally {
    fixture.cleanup();
  }
}

function snapshotResponse(
  observation: Observation,
  repoPath: string,
  paths: readonly string[] | undefined,
  repeatIndex: number,
): ProviderResponse {
  const response = {
    output: observation.finalText,
    cost: observation.costUsd,
    metadata: { observation, repeatIndex },
  };
  try {
    if (paths !== undefined) {
      response.metadata.observation = {
        ...observation,
        repoFiles: snapshotRepoFiles(repoPath, paths),
      };
    }
  } catch (error) {
    return { ...response, ...errorResponse(error) };
  }
  return response;
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
