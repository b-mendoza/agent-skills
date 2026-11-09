import { Schema } from "effect";

import {
  gitHeadSchema,
  gitStatusSchema,
} from "#/observation/mutation-evidence.ts";

const toolCallSchema = Schema.Struct({
  name: Schema.String,
  input: Schema.Record(Schema.String, Schema.Unknown),
  id: Schema.optional(Schema.String),
  result: Schema.optional(
    Schema.Struct({
      content: Schema.String,
      isError: Schema.Boolean,
      truncated: Schema.Boolean,
    }),
  ),
});
export type ToolCall = {
  -readonly [
    Key in keyof typeof toolCallSchema.Type
  ]: (typeof toolCallSchema.Type)[Key];
};
const verdictFields = {
  subtype: Schema.String,
  // Expired credentials can yield subtype "success" with isError true.
  isError: Schema.Boolean,
  finalText: Schema.String,
  // SDK session total, not a per-turn increment.
  costUsd: Schema.Number,
};
const evidenceFields = {
  toolCalls: Schema.mutable(Schema.Array(toolCallSchema)),
  gitStatusBefore: gitStatusSchema,
  gitStatusAfter: gitStatusSchema,
  timedOut: Schema.Boolean,
};
export const turnSchema = Schema.Struct({
  ...verdictFields,
  ...evidenceFields,
  name: Schema.String,
  /** Null means the gate failed and no user message was sent. */
  prompt: Schema.NullOr(Schema.String),
  gitHeadBefore: gitHeadSchema,
  gitHeadAfter: gitHeadSchema,
});
export type TurnObservation = typeof turnSchema.Type;
export const observationSchema = Schema.Struct({
  ...verdictFields,
  ...evidenceFields,
  durationMs: Schema.Number,
  /** Optional to accept historical single-turn exports and existing check fixtures. */
  turns: Schema.optional(Schema.Array(turnSchema)),
  repoFiles: Schema.optional(
    Schema.Record(Schema.String, Schema.NullOr(Schema.String)),
  ),
});
export type Observation = {
  -readonly [
    Key in keyof typeof observationSchema.Type
  ]: (typeof observationSchema.Type)[Key];
};
export type ResultVerdict = Pick<
  Observation,
  "subtype" | "isError" | "finalText" | "costUsd"
>;

export type FollowUpReply =
  | { readonly reply: string }
  | { readonly gateNotReached: string };
export interface FollowUpTurn {
  readonly name: string;
  /** Runs synchronously against all settled turns, including the latest result and git samples. */
  readonly reply: (observation: Observation) => FollowUpReply;
}
