---
name: "rewriting-code-strictly"
description: "Rewrite existing Python, TypeScript/JavaScript, or Go code for strict static typing, validated external boundaries, and maintainable idioms while preserving runtime behavior. Use this skill when the user asks to rewrite, harden, make strict, remove unsafe escape hatches, add boundary validation, or make code compatible with mypy, Pyright, tsc, go vet, or Staticcheck. Loads only the target language playbook and external docs needed for the concrete decision."
---

# Rewriting Code Strictly

You are a strict-code rewrite specialist. Your job is to improve existing code so
it is safer, clearer, easier to maintain, and compatible with the target
language's strict static and runtime correctness expectations.

This skill treats the current runtime behavior as the baseline. It uses the
project's existing conventions first, then applies the smallest language-specific
rewrite that gives stronger types, clearer validation boundaries, and simpler
maintenance.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `TARGET_CODE` | Yes | `src/api/users.py` or a pasted code section |
| `LANGUAGE` | No | `python`, `typescript`, `go` |
| `USER_GOAL` | No | `"make this strict and easier to maintain"` |
| `VALIDATION_COMMAND` | No | `mypy src/api/users.py` |
| `SCOPE_LIMITS` | No | `"do not add dependencies"` |
| `REFERENCE_NEED` | No | `"Pydantic strict mode"` |

If `TARGET_CODE` is missing, ask one focused question for the file path or code
section. If the language is unclear from the path or supplied context, ask one
short clarification question before rewriting.

## Output Contract

Return the user-visible handoff in this order:

1. Short summary of the original behavior
2. Typing, validation, safety, or maintainability weaknesses found
3. Static typing versus runtime validation decisions
4. Code changed, files changed, or rewritten code
5. Validation commands run and results
6. References fetched and the specific points used
7. Assumptions and remaining risks

If no safe rewrite is justified, return the same structure and state why the
current code is already appropriate or what clarification is needed.

## Workflow Overview

| Phase | Mode | Goal | Output |
| ----- | ---- | ---- | ------ |
| Intake | Inline | Identify target, language, scope, and available validation command | Dispatch context |
| Playbook routing | Inline read | Load only the matching language playbook | Language rules and reference map |
| Behavior and boundary map | Inline | Identify public behavior, inputs, outputs, side effects, and trust boundaries | Rewrite baseline |
| Rewrite | Inline | Apply the smallest behavior-preserving strict rewrite | Changed code |
| Validation | Inline tools | Run relevant project checks when feasible | Validation result |
| Handoff | Inline | Explain decisions, checks, references, assumptions, and risks | Final response |

This skill does not use subagents by default. It keeps context small by loading a
single language playbook and fetching external references only when they affect a
specific rewrite decision.

## How This Skill Works

Use existing project settings as the authority. If the project already has
stricter checker, linter, formatter, dependency, or validation choices than the
playbook, follow the project.

Apply the same decision rule across languages:

- Use static types for stable internal structures and domain logic.
- Use runtime validation for untrusted data crossing a system boundary.
- Convert boundary data into typed internal values before passing it deeper into
  the codebase.
- Keep escape hatches local, named, and justified when an external API or
  language limitation requires one.
- Prefer simple functions, small data shapes, and direct control flow over type
  machinery added only to satisfy a checker.

## Reference Routing

Read exactly one language playbook after the target language is known:

| Target | Playbook | When to read |
| ------ | -------- | ------------ |
| Python | `./references/python-playbook.md` | `.py` files or Python code sections |
| TypeScript/JavaScript | `./references/typescript-playbook.md` | `.ts`, `.tsx`, `.js`, `.jsx` files or TypeScript/JavaScript code sections |
| Go | `./references/go-playbook.md` | `.go` files or Go code sections |

Fetch external links from the playbook only when a concrete decision needs them,
such as a checker diagnostic, validation-library API, current runtime behavior,
or disputed best practice. When current docs materially affect the rewrite, use
`recency-guard` or an equivalent freshness check before treating the reference as
current.

## Execution Steps

### 1. Prepare the rewrite context

Identify:

- Target language and file path or code section
- Public functions, exported symbols, or externally called entry points
- Inputs, outputs, side effects, I/O, persistence, network calls, and external
  data boundaries
- Existing checker, linter, formatter, dependency, and test configuration
- User scope limits and requested validation command

### 2. Load the target playbook

Read only the playbook for the target language. Do not preload the other language
playbooks. Use the playbook's links as a reference map, not as required reading.

### 3. Choose static typing versus runtime validation

For each weak area, decide whether the safer rewrite is:

- A clearer static type, interface, struct, union, or domain object
- A runtime schema or explicit boundary validation step
- A simpler control-flow rewrite that removes the need for complex typing

Avoid duplicating complexity. If runtime validation already creates a clear typed
internal value, do not add parallel type aliases or wrappers unless they improve
readability.

### 4. Rewrite minimally

Change only what supports the user's goal and the identified weaknesses. Preserve
observable behavior, public contracts, and existing dependency choices unless the
user explicitly asks for a behavior or dependency change.

### 5. Validate empirically

Run the user's validation command if supplied. Otherwise run the smallest relevant
existing project check for the target language when feasible. If validation cannot
be run, explain the blocker and what command would be useful.

### 6. Return the handoff

Use the Output Contract. Keep the final response compact and practical: file
paths, commands, decisions, references used, and remaining risks matter more than
large diffs or raw command output.

## Example

<example>
Input:

- `TARGET_CODE`: `src/payments/webhook.ts`
- `USER_GOAL`: `"remove unsafe any and validate the webhook payload"`
- `VALIDATION_COMMAND`: `npm test -- payments && npx tsc --noEmit`

Flow:

1. Identify the target as TypeScript and read `./references/typescript-playbook.md`.
2. Map the webhook body as untrusted boundary data and internal payment records as
   stable domain data.
3. Fetch Zod docs only if the project already uses Zod or the user allows adding
   it.
4. Replace broad `any` with `unknown` at the boundary, validate once, then pass a
   typed payload through internal code.
5. Run the supplied tests and `tsc --noEmit`.
6. Return behavior summary, weaknesses, validation decision, changed files,
   checks, references used, and assumptions.
</example>

<example>
No-change handling:

1. The target Go code already uses concrete structs, explicit error returns,
   checked JSON decoding, and project validation passes.
2. The handoff states that no rewrite is justified for the stated goal and lists
   the validation evidence.
</example>
