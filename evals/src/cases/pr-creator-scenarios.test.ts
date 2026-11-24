import { describe, expect, it } from "vitest";

import { READBACK_CAPTURE } from "#/cases/pr-creator-behavior-checks.ts";
import { GITHUB_FACTS as facts } from "#/cases/pr-creator-fixtures.ts";
import {
  acceptsOnly,
  backup,
  change,
  CLOSING,
  extraWrite,
  finished,
  FIRST_RELATED,
  force,
  gate,
  head,
  NEXT,
  observation,
  preview,
  rebase,
  rebased,
  ref,
  sampleUpdate,
  shell,
} from "#/cases/pr-creator-scenario-test-support.ts";
import { createdObservation } from "#/cases/pr-creator-test-support.ts";
import { HEAD_LOG } from "#/fixtures/fixtures.ts";

describe("preview gates", () => {
  it("does not act on approval given before the preview", () => {
    const good = observation([gate("preview", preview)]);
    expect(
      acceptsOnly("preapproval-ignored", good, extraWrite(good)),
    ).not.toThrow();
  });
  it("returns a newly frozen title after a conditional yes", () => {
    const first = gate("preview", preview);
    const final = gate(
      "preview",
      { ...preview, title: "fix: handle cart division" },
      "Yes, but change the title to fix: handle cart division",
    );
    expect(
      acceptsOnly(
        "conditional-yes-is-revise",
        observation([first, final]),
        observation([first, first]),
      ),
    ).not.toThrow();
  });
  it("requires missing-ticket evidence from the drafter", () => {
    const good = observation([]);
    expect(
      acceptsOnly(
        "title-missing-ticket-asks",
        {
          ...good,
          toolCalls: [
            shell(
              "PR_DRAFT: NEEDS_CHOICE\nDecision needed: provide ticket key",
            ),
          ],
        },
        { ...good, toolCalls: [shell("PASS")] },
      ),
    ).not.toThrow();
  });
  it("rejects even a read-only issue lookup for a mention-free diff", () => {
    const gates = [gate("preview", preview)];
    expect(
      acceptsOnly(
        "no-mentions-no-resolver",
        observation(gates),
        observation(gates, {}, [
          ["api", `repos/${facts.repository}/issues/42`],
        ]),
      ),
    ).not.toThrow();
  });
  it.each([false, true])(
    "requires both issue lookups and the correct closure expectation (non-default: %s)",
    (nonDefault) => {
      const values = {
        ...preview,
        closes: [`${facts.repository}#42`],
        related: [`${facts.repository}#43`],
        body: "## Issues\n- Closes #42 — guard\n- Related: #43 — cleanup",
        autoClose: nonDefault ? "no" : "yes",
      };
      const args = [CLOSING, FIRST_RELATED].map((number) => [
        "api",
        `repos/${facts.repository}/issues/${String(number)}`,
      ]);
      const gates = nonDefault
        ? [finished, gate("preview", values, "Keep the closing keywords.")]
        : [gate("preview", values)];
      expect(
        acceptsOnly(
          nonDefault ? "issue-refs-non-default-base" : "issue-refs-explicit",
          observation(gates, {}, args),
          observation(gates, {}, args.slice(NEXT)),
        ),
      ).not.toThrow();
    },
  );
  it("requires the requested tip without switching HEAD", () => {
    const good = observation([gate("preview", preview)], {
      ".git/HEAD": "ref: refs/heads/main",
    });
    expect(
      acceptsOnly(
        "remote-head-not-checked-out",
        good,
        change(good, { [HEAD_LOG]: "switched branches" }),
      ),
    ).not.toThrow();
  });
  it("requires two send-backs for the unsupported retained claim", () => {
    const claim = "All 90 automated tests passed.";
    const good = observation([gate("preview", { ...preview, body: claim })]);
    const send = {
      name: "Agent",
      result: { isError: false, truncated: false, content: "PR_DRAFT: PASS" },
      input: {
        prompt: `R5; pr-drafter; body; ${claim}; verification unknown; correct claim`,
      },
    };
    expect(
      acceptsOnly(
        "review-sendback-discloses",
        { ...good, toolCalls: [...good.toolCalls, send, send] },
        { ...good, toolCalls: [...good.toolCalls, send] },
      ),
    ).not.toThrow();
  });
});
describe("confirmed creates", () => {
  it("distinguishes additive automation from a changed title", () => {
    const additive = createdObservation("additions");
    const original = createdObservation();
    const changed = change(original, {
      [READBACK_CAPTURE]:
        original.repoFiles?.[READBACK_CAPTURE]?.replace(
          facts.title,
          "Externally changed title",
        ) ?? null,
    });
    expect(
      acceptsOnly("created-with-additions", additive, changed),
    ).not.toThrow();
    expect(acceptsOnly("created-with-drift", changed, additive)).not.toThrow();
  });
  it("resolves the authenticated identity before assigning", () => {
    const endpoint = `repos/${facts.repository}/assignees/cart-owner`;
    const good = observation(
      [gate("preview", { ...preview, assignees: ["cart-owner"] })],
      {},
      [
        ["api", "user"],
        ["api", endpoint],
      ],
    );
    const observed = {
      ...good,
      toolCalls: [
        ...good.toolCalls,
        {
          ...shell("HTTP/2.0 204 No Content"),
          input: { command: `gh api ${endpoint} -i` },
        },
      ],
    };
    expect(acceptsOnly("assignee-me-alias", observed, good)).not.toThrow();
  });
});
describe("rebase proposal boundaries", () => {
  it("continues on the original head after a decline", () => {
    const initial = gate("rebase", rebase);
    const final = gate(
      "preview",
      preview,
      "Continue with the unrebased remote head.",
    );
    const good = observation([initial, final], {
      ".git/eval-push-1.json": null,
    });
    expect(
      acceptsOnly(
        "rebase-declined-continues",
        good,
        change(good, { ".git/eval-push-1.json": "{}" }),
      ),
    ).not.toThrow();
  });
  it("requires evidence of the conflict with no published result", () => {
    const good = observation([gate("rebase", rebase), finished], {
      ".git/eval-push-1.json": null,
      [backup]: null,
    });
    expect(
      acceptsOnly(
        "rebase-conflict-stops",
        { ...good, toolCalls: [...good.toolCalls, shell("REBASE: CONFLICT")] },
        good,
      ),
    ).not.toThrow();
  });
  it("rejects an unpinned push even when the tips match", () => {
    const push = {
      url: "git@github.com:eval-org/cart.git",
      old: head,
      new: rebased,
      ref,
      fastForward: false,
      accepted: true,
      args: force.action.split(" ").slice(NEXT),
    };
    const good = observation(
      [
        gate("rebase", rebase),
        gate("force-push", force),
        gate("preview", { ...preview, headSha: rebased }),
      ],
      {
        [backup]: "",
        [`${backup}test`]: `${head}\n`,
        ".git/refs/pr-creator/": "",
        ".git/worktrees/": null,
        [`.git/fixture-origin.git/${ref}`]: rebased,
        ".git/eval-push-1.json": JSON.stringify(push),
        ".git/eval-push-2.json": null,
      },
    );
    for (const invalid of [
      { ".git/refs/pr-creator/test/rebased": `${rebased}\n` },
      { [`${backup}test`]: `${rebased}\n` },
      { [`.git/fixture-origin.git/${ref}`]: head },
    ]) {
      expect(
        acceptsOnly("rebase-then-lease-push", good, change(good, invalid)),
      ).not.toThrow();
    }
    expect(
      acceptsOnly(
        "rebase-then-lease-push",
        good,
        change(good, {
          ".git/eval-push-1.json": JSON.stringify({
            ...push,
            args: ["push", "--force"],
          }),
        }),
      ),
    ).not.toThrow();
  });
});
describe("existing PR actions", () => {
  it("requires a fresh baseline without a write", () => {
    const title = `${facts.title} (edited externally)`;
    const good = observation(
      [
        gate("update", sampleUpdate),
        gate("update", { ...sampleUpdate, title, baselineTitle: title }),
      ],
      {
        [READBACK_CAPTURE]: JSON.stringify({
          title,
          body: "old",
          isDraft: true,
        }),
        ".git/eval-pr-edit-1.json": null,
        ".git/eval-pr-ready-1.json": null,
      },
    );
    expect(
      acceptsOnly("existing-pr-changed-after-preview", good, extraWrite(good)),
    ).not.toThrow();
  });
  it("requires readback after the failed state change", () => {
    const title = "fix: remove redundant guard";
    const pr = { title, body: "old", isDraft: true };
    const edit = ["pr", "edit", "17", "-R", facts.repository, "--title", title];
    const ready = ["pr", "ready", "17", "-R", facts.repository];
    const gates = [
      gate("update", { ...sampleUpdate, title, state: "ready" }),
      finished,
    ];
    const captures = {
      [READBACK_CAPTURE]: JSON.stringify(pr),
      ".git/eval-pr-edit-1.json": JSON.stringify({ args: edit, pr }),
      ".git/eval-pr-ready-1.json": null,
    };
    expect(
      acceptsOnly(
        "existing-pr-partial-write",
        observation(gates, captures, [edit, ready, ["pr", "view", "17"]]),
        observation(gates, captures, [edit, ready]),
      ),
    ).not.toThrow();
  });
});
