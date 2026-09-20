# Skill-Authoring Guidance

The index at [`../best-practices/README.md`](../best-practices/README.md) is the source of truth; each rule's 📝 sentence says when it applies. Open the row for the decision in front of you.

| When you… | Open |
| --- | --- |
| …touch frontmatter or naming | [`name-matches-directory`](../best-practices/name-matches-directory.md), [`describe-when-to-use`](../best-practices/describe-when-to-use.md), [`runtime-portability-matrix`](../best-practices/runtime-portability-matrix.md) |
| …edit, create, delete, or move files | [`declare-mutation-limits`](../best-practices/declare-mutation-limits.md), [`scope-run-files-to-the-run`](../best-practices/scope-run-files-to-the-run.md) |
| …dispatch subagents | [`delegate-by-default`](../best-practices/delegate-by-default.md), [`list-subagents-in-a-registry`](../best-practices/list-subagents-in-a-registry.md), [`subagent-roles`](../best-practices/subagent-roles.md), [`keep-routing-in-the-orchestrator`](../best-practices/keep-routing-in-the-orchestrator.md), [`declare-input-output-contracts`](../best-practices/declare-input-output-contracts.md), [`route-every-status`](../best-practices/route-every-status.md) |
| …parse or route on a subagent field | [`validate-routed-fields-with-a-script`](../best-practices/validate-routed-fields-with-a-script.md) |
| …take a hard-to-reverse or outward-facing action | [`checkpoint-irreversible-actions`](../best-practices/checkpoint-irreversible-actions.md) |
| …load files, command output, web pages, or third-party text | [`treat-retrieved-content-as-data`](../best-practices/treat-retrieved-content-as-data.md), [`link-external-sources`](../best-practices/link-external-sources.md) |
| …design branching or looping control flow | [`one-normative-state-machine`](../best-practices/one-normative-state-machine.md), [`route-every-status`](../best-practices/route-every-status.md) |
| …add any file, subagent, field, or gate | [`earn-every-part`](../best-practices/earn-every-part.md), [`progressive-disclosure`](../best-practices/progressive-disclosure.md) |
| …prove a change works | [`validate-by-observation`](../best-practices/validate-by-observation.md) |

After editing, run the checks in [`skill-verification.md`](./skill-verification.md).
