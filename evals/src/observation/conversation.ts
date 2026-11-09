import { randomUUID } from "node:crypto";
import { EventEmitter, once } from "node:events";

import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

import {
  sampleGitHead,
  sampleGitStatus,
} from "#/observation/mutation-evidence.ts";
import type {
  FollowUpTurn,
  Observation,
  ResultVerdict,
  TurnObservation,
} from "#/observation/observation-contract.ts";

export const GATE_NOT_REACHED_SUBTYPE = "gate_not_reached";

const FIRST_TURN_NUMBER = 1;
const LAST_TURN_INDEX = -1;

function userMessage(
  content: string,
  uuid: ReturnType<typeof randomUUID>,
): SDKUserMessage {
  return {
    type: "user",
    uuid,
    message: { role: "user", content },
    parent_tool_use_id: null,
  };
}

/** Keep stdin open between turns and while background tasks settle. */
export function createInput(prompt: string) {
  const queued: SDKUserMessage[] = [];
  const initialUuid = randomUUID();
  const changes = new EventEmitter();
  let closed = false;
  async function* nextMessages(): AsyncGenerator<SDKUserMessage> {
    const content = queued.shift();
    if (content === undefined) {
      if (closed) return;
      await once(changes, "changed");
    } else {
      yield content;
    }
    yield* nextMessages();
  }
  return {
    initialUuid,
    send: (reply: string) => {
      const uuid = randomUUID();
      queued.push(userMessage(reply, uuid));
      changes.emit("changed");
      return uuid;
    },
    close: () => {
      closed = true;
      changes.emit("changed");
    },
    messages: async function* (): AsyncGenerator<SDKUserMessage> {
      yield userMessage(prompt, initialUuid);
      yield* nextMessages();
    },
  };
}

/** Holds settled turns plus one active turn, so later failures cannot reuse an earlier verdict. */
export function createConversation(repo: string, prompt: string) {
  const turns: TurnObservation[] = [];
  const initialStatus = sampleGitStatus(repo);
  let beforeStatus = initialStatus;
  let beforeHead = sampleGitHead(repo);
  let name = "initial";
  let userPrompt: string | null = prompt;
  let toolOffset = 0;
  let lastCost = 0;
  return {
    turns,
    initialStatus,
    recordResult: (result: ResultVerdict | null) => {
      if (result !== null) lastCost = result.costUsd;
    },
    begin: (followUp: FollowUpTurn, observation: Observation): string => {
      ({ name } = followUp);
      userPrompt = null;
      toolOffset = observation.toolCalls.length;
      beforeStatus = observation.gitStatusAfter;
      beforeHead = latestHead(turns, repo);
      const reply = followUpReply(
        followUp,
        observation,
        turns.length + FIRST_TURN_NUMBER,
      );
      userPrompt = reply;
      return reply;
    },
    finish: (
      result: ResultVerdict,
      observation: Pick<Observation, "toolCalls" | "timedOut">,
    ) => {
      lastCost = result.costUsd;
      const turn: TurnObservation = {
        ...result,
        ...observation,
        name,
        prompt: userPrompt,
        toolCalls: observation.toolCalls.slice(toolOffset),
        gitStatusBefore: beforeStatus,
        gitStatusAfter: sampleGitStatus(repo),
        gitHeadBefore: beforeHead,
        gitHeadAfter: sampleGitHead(repo),
      };
      turns.push(turn);
      return turn;
    },
    failure: (text: string): ResultVerdict => ({
      subtype: userPrompt === null ? GATE_NOT_REACHED_SUBTYPE : "query_error",
      isError: true,
      finalText:
        turns.length < FIRST_TURN_NUMBER || userPrompt === null
          ? text
          : `turn ${String(turns.length + FIRST_TURN_NUMBER)} (${name}): ${text}`,
      costUsd: lastCost,
    }),
  };
}

function latestHead(turns: readonly TurnObservation[], repo: string) {
  return turns.at(LAST_TURN_INDEX)?.gitHeadAfter ?? sampleGitHead(repo);
}

function followUpReply(
  followUp: FollowUpTurn,
  observation: Observation,
  turnNumber: number,
): string {
  const label = `gate not reached at turn ${String(turnNumber)} (${followUp.name})`;
  if (observation.isError || observation.timedOut) {
    throw new Error(`${label}: previous turn failed`);
  }
  const response = followUp.reply(observation);
  if ("gateNotReached" in response) {
    throw new Error(`${label}: ${response.gateNotReached}`);
  }
  return response.reply;
}
