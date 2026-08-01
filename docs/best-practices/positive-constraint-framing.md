# positive-constraint-framing

## Tier

`recommended`. Positive framing improves the agent's working model; hard boundaries still need enforcement at tool, permission, mutation, and validation layers.

## When it applies

When defining behavioral boundaries in skill or subagent prose: allowed tools, allowed write paths, allowed dispatch targets, allowed mutation scopes, allowed escalation routes.

## The practice

When defining behavioral boundaries, name what the agent is allowed to do before naming what it should avoid.

Positive framing is prompt guidance, not enforcement. Tool permissions, mutation scopes, validation gates, and runtime controls still carry hard boundaries. Use explicit restrictions when safety, permission, or mutation boundaries need enforcement, but lead with the allowed path so the agent has a clear working model.

**Ordering check.** In every section, each categorical exclusion list must be preceded by the allowed-path statement for that boundary in the same section. A reviewer should be able to verify this ordering mechanically.

## Rationale

A pure negation list ("do not write outside scope, do not call external APIs, do not modify the vendored mirror") gives the agent a boundary without a behavior. The agent now knows what is forbidden but must infer what is allowed. The inference is unreliable: the agent may default to "do nothing" (a workflow stall), to "do the narrowest thing" (under-implementation), or to "do the same thing without the named forbidden tool" (boundary circumvention).

A positive frame restores the working model. "The orchestrator may call Agent and Read; everything else is a dispatch" tells the agent both what to do and what not to do. The agent can act with confidence; the negation list becomes a backstop, not the primary contract.

The "still need enforcement" rule closes the second failure. Positive prose is not a sandbox. Tool permissions, mutation scopes, and validators are the actual boundary; the prose helps the agent stay inside the boundary willingly.

## Concrete examples

Good: allowed-first framing for an orchestrator's tool use.

```markdown
The only tools the orchestrator calls directly are Agent and Read, limited to loading skill, subagent, and reference files. Every other operation is a dispatch to the appropriate subagent.
```

Bad: pure negation gives the agent no working model and no prioritized allowed path.

```markdown
The orchestrator must not run shell commands. The orchestrator must not edit files. The orchestrator must not call external APIs. The orchestrator must not skip phases. (Now what should it actually do?)
```

## References

- Anthropic Claude prompting best practices, accessed 2026-07-22: <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices>. Explicitly recommends telling Claude what to do instead of what not to do.
