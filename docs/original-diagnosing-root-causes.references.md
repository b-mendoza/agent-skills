# External References for `diagnosing-root-causes`

These resources are relevant to the target skill's domain: evidence-first root cause analysis across runtime issues, CI/CD failures, and user-reported problems. They are not replacements for the local skill contract. The skill's source files remain authoritative for behavior, safety boundaries, subagent routing, output shape, and terminal statuses.

| Resource | What it is | Why it is relevant |
| -------- | ---------- | ------------------ |
| [GitHub Actions documentation](https://docs.github.com/actions) | Official GitHub Actions documentation, including workflow syntax and run/log concepts. | The target skill explicitly names GitHub Actions as a CI/CD context and its `external-sources.md` lists GitHub Actions as the source for workflow syntax and log structure. |
| [GitLab CI/CD documentation](https://docs.gitlab.com/ee/ci/) | Official GitLab CI/CD documentation covering pipeline configuration and CI behavior. | The target skill explicitly names GitLab CI as a CI/CD context and its external-source policy lists GitLab CI/CD pipeline configuration as an external reference when local evidence needs syntax interpretation. |
| [AWS CodePipeline documentation](https://docs.aws.amazon.com/codepipeline/) | Official AWS CodePipeline documentation for pipeline concepts and troubleshooting. | The target skill explicitly names AWS CodePipeline as a supported CI/CD context and points to AWS CodePipeline concepts and troubleshooting for current platform behavior. |
| [Google SRE book, "Postmortem Culture: Learning from Failure"](https://sre.google/sre-book/postmortem-culture/) | A reliability engineering chapter on learning from incidents through postmortems. | The target skill's educational RCA report, evidence traceability, and non-punitive learning posture align with postmortem practices that emphasize learning why failures happened and how to prevent recurrence. |
| [Atlassian incident management guide: 5 Whys](https://www.atlassian.com/incident-management/postmortem/5-whys) | A practical incident-management guide to the 5 Whys RCA technique and cause-and-effect thinking. | It is comparable background for forming and evaluating hypotheses, while the target skill's local contract is stricter about named evidence, source validation, and not forcing a single cause. |
| [Context7 MCP documentation lookup](https://context7.com/) | A documentation retrieval service for library and framework API references. | The target skill's `external-sources.md` says library, framework, or SDK API and error behavior should prefer the `context7` MCP docs tool when available, otherwise official project documentation. |
| Official language and runtime documentation | Official documentation for the language or runtime involved in a specific issue, such as Python, Node.js, Java, Go, or a framework runtime. | The target skill's external-source policy directs agents to official language or runtime documentation when interpreting current error semantics; the exact resource depends on the user's `RESOURCES` and environment. |
| Official project documentation for the affected dependency, framework, SDK, or tool | The canonical docs, API reference, changelog, or troubleshooting guide for the component involved in the issue. | The skill allows external pages as evidence for current tool or runtime behavior, but only as one validated source alongside local logs, code, config, version history, and other supplied artifacts. |

## Use Notes

- Prefer local `RESOURCES` and the target skill's bundled references before external pages.
- Fetch the smallest relevant external page only when current syntax, error semantics, platform behavior, or API behavior affects the diagnosis.
- Treat external pages as evidence to validate, not as confirmed facts.
- If network access or current documentation is unavailable, label any affected conclusion as a hypothesis or unresolved gap instead of asserting version-specific behavior.

## Source Grounding

The reference choices above are grounded in `skills/diagnosing-root-causes/references/external-sources.md`, which names GitHub Actions, GitLab CI/CD, AWS CodePipeline, Context7 or official project docs, and official language/runtime docs as external sources. The broader RCA and postmortem resources are included as comparable external practices for the skill's evidence-first investigation, causal-chain explanation, hypothesis honesty, and educational report goals as defined in `SKILL.md`, `references/investigation-guide.md`, and `references/output-contract.md`.
