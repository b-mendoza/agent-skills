# External References for generate-flow-diagram

These resources are relevant to the `generate-flow-diagram` skill because they support Mermaid syntax, diagram validation, progressive disclosure, workflow visualization, or human-in-the-loop gates. The target skill's own `references/external-sources.md` names these as optional just-in-time sources; the bundled skill files remain authoritative for execution.

| Resource | What It Is | Why It Is Relevant |
| -------- | ---------- | ------------------ |
| [Mermaid Flowchart Syntax](https://mermaid.js.org/syntax/flowchart.html) | Official Mermaid documentation for flowchart syntax, node and edge forms, directions, classes, labels, and known parsing cautions. | The skill emits Mermaid `flowchart` diagrams and its style guide mirrors Mermaid-specific concerns such as quoted labels, `flowchart TD`, class assignments, lowercase `end`, and accidental `o` or `x` edge markers. |
| [Mermaid Live Editor](https://mermaid.live/) | Browser-based Mermaid editor and renderer. | The skill's quality gate checks Mermaid validity. This editor is a practical external tool for experimenting with or rendering candidate syntax when local guidance is not enough. |
| [NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Nielsen Norman Group guidance on revealing complexity gradually. | The skill is explicitly organized around progressive loading: `SKILL.md` stays a routing layer while detailed contracts live in references and subagents are read only when dispatched. |
| [NN/g: Wireflows](https://www.nngroup.com/articles/wireflows/) | Nielsen Norman Group article on combining wireframes and flowcharts to communicate interactions and workflows. | The skill's deliverable is a workflow visualization that exposes decisions, gates, outputs, and terminal states. Wireflow guidance is relevant background for making process diagrams understandable and action-oriented. |
| [IBM: Human In The Loop](https://www.ibm.com/think/topics/human-in-the-loop) | IBM explainer on keeping human oversight in AI systems and decision processes. | The skill requires explicit approve and decline branches for sensitive actions and routes unapproved actions to confirmation, handoff, blocker, or escalation paths. |

## Target-Mentioned But Not Verified In This Run

| Resource | Status | Why It Still Matters |
| -------- | ------ | -------------------- |
| [skills.sh progressive-disclosure example](https://skills.sh/flpbalada/my-opencode-config/progressive-disclosure) | The target skill lists this as a public progressive-disclosure example, but the page returned an internal error when checked on 2026-06-11. | It is source-grounded as a target-mentioned optional resource, but it should be rechecked before citing its contents or treating it as verified background. |

## Notes

- No external resource in this file replaces the local contracts in `skills/generate-flow-diagram/SKILL.md`, `references/`, or `subagents/`.
- The references emphasize comparable techniques rather than unrelated diagramming products because the target skill is an agent workflow contract, not a general diagramming application.
