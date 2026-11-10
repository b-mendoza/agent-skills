import { Predicate, Schema } from "effect";

import type { ResultVerdict } from "#/observation/observation-contract.ts";

const REPLY_TYPES = new Set<unknown>(["assistant", "stream_event", "result"]);
const NO_IDENTITIES = 0;
const decodeReplyIdentity = Schema.decodeUnknownSync(
  Schema.Struct({
    user_message_uuid: Schema.optional(Schema.String),
    user_message_uuids: Schema.optional(Schema.Array(Schema.String)),
    parent_tool_use_id: Schema.optional(Schema.NullOr(Schema.String)),
  }),
);

function replyIdentity(message: unknown) {
  if (!Predicate.isObject(message)) return undefined;
  if (!REPLY_TYPES.has(message["type"])) return undefined;
  return decodeFrameIdentity(message);
}

function decodeFrameIdentity(message: Record<string, unknown>) {
  const identity = decodeReplyIdentity(message);
  const single =
    identity.user_message_uuid === undefined
      ? []
      : [identity.user_message_uuid];
  return {
    ids: [...single, ...(identity.user_message_uuids ?? [])],
    activity:
      ["assistant", "stream_event"].includes(String(message["type"])) &&
      identity.parent_tool_use_id == null,
  };
}

type ReplyIdentity = NonNullable<ReturnType<typeof replyIdentity>>;

function isCurrentReply(identity: ReplyIdentity, uuid: string): boolean {
  return identity.ids.length === NO_IDENTITIES || identity.ids.includes(uuid);
}

function marksActivity(
  identity: ReplyIdentity,
  uuid: string,
  previous: boolean,
): boolean {
  return previous || identity.ids.includes(uuid) || identity.activity;
}

function fallbackSettles(
  verdict: ResultVerdict,
  previousCost: number | null,
  activitySeen: boolean,
): boolean {
  return (
    previousCost === null ||
    verdict.isError ||
    activitySeen ||
    verdict.costUsd !== previousCost
  );
}

/** Echo support belongs to the session, not just its current user turn. */
export function createTurnCorrelationSession() {
  let echoesSeen = false;
  const observeEchoes = (identity: ReplyIdentity): boolean => {
    echoesSeen ||= identity.ids.length > NO_IDENTITIES;
    return echoesSeen;
  };
  return (uuid: string, previousCost: number | null) =>
    createTurnCorrelation(uuid, previousCost, observeEchoes);
}

/** Prefer SDK client UUID echoes; older producers need observable progress before a same-cost result. */
function createTurnCorrelation(
  uuid: string,
  previousCost: number | null,
  observeEchoes: (identity: ReplyIdentity) => boolean,
) {
  let activitySeen = false;
  let echoesSeen = false;
  let ownResultSeen = false;
  const fallbackResult = (verdict: ResultVerdict) =>
    !echoesSeen && fallbackSettles(verdict, previousCost, activitySeen);
  // A live task delays settlement; retain the user result across notification replies.
  const observeResult = (identity: ReplyIdentity, verdict: ResultVerdict) => {
    const ownResult = identity.ids.includes(uuid) || fallbackResult(verdict);
    ownResultSeen ||= ownResult;
    return ownResultSeen || verdict.isError;
  };
  return {
    acceptsMessage: (message: unknown): boolean => {
      const identity = replyIdentity(message);
      if (identity === undefined) return true;
      echoesSeen = observeEchoes(identity);
      if (!isCurrentReply(identity, uuid)) return false;
      activitySeen = marksActivity(identity, uuid, activitySeen);
      return true;
    },
    settles: (
      verdict: ResultVerdict,
      message: unknown,
      tasksLive: boolean,
    ): boolean => {
      const identity = replyIdentity(message);
      if (identity === undefined || !isCurrentReply(identity, uuid)) {
        return false;
      }
      const eligible = observeResult(identity, verdict);
      return !tasksLive && eligible;
    },
  };
}
