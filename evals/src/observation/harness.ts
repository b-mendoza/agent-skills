// Public observation entry point. Capability modules stay internal so callers
// in cases and orchestration keep one stable import path.

export {
  observeClaude,
  QUERY_ERROR_SUBTYPE,
} from "#/observation/agent-query.ts";
export type { AgentQueryRequest } from "#/observation/agent-query-service.ts";
export {
  AgentQuery,
  AgentQueryLive,
  QueryStartError,
  QueryStreamError,
  SdkMessageValidationError,
} from "#/observation/agent-query-service.ts";
export type { GitStatus } from "#/observation/git-status.ts";
export {
  describeGitStatus,
  GitSampler,
  GitSamplerLive,
  gitStatus,
} from "#/observation/git-status.ts";
export {
  mutationEvidence,
  skillInvocations,
} from "#/observation/mutation-evidence.ts";
export type {
  Observation,
  RunOptions,
  ToolCall,
} from "#/observation/observation-types.ts";
