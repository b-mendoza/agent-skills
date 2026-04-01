# Critique Analyzer — Output Template

This is the output template loaded by the critique-analyzer subagent at write time.

> Downstream skills parse this report structure programmatically. Missing sections break the pipeline.

---

## Critique Report

### Mode

<upfront | critique>

### Artifacts Reviewed

- <list each file path reviewed>

### Codebase Verification

| Check             | Finding                                   |
| ----------------- | ----------------------------------------- |
| Package manager   | <npm/yarn/pnpm/bun — from lockfile>       |
| Runtime           | <Node version from .nvmrc or engines>     |
| Framework         | <what the project actually uses>          |
| Test framework    | <what the project actually uses>          |
| Key dependencies  | <top 5-10 relevant deps from manifest>    |
| Existing patterns | <architectural patterns observed in code> |
| Deployment target | <from config files, CI/CD, Dockerfiles>   |

### Problem Framing Critique (upfront mode only)

| #   | Severity | Dimension              | Finding                         | Why this matters        | Tier   |
| --- | -------- | ---------------------- | ------------------------------- | ----------------------- | ------ |
| PF1 | HIGH     | <End User / Need / …>  | <what's missing or problematic> | <impact on the project> | Tier 3 |
| PF2 | MEDIUM   | <Solution-Problem Fit> | <gap or assumption identified>  | <risk if not addressed> | Tier 2 |

#### PF1: <short title>

**Dimension:** <End User / Underlying Need / Solution-Problem Fit / Alternative
Approaches / Evidence Basis>

**Finding:** <what the task-planner stated and why it is problematic or
insufficient>

**Why this matters:** <concrete impact — what could go wrong if the developer
proceeds without addressing this>

**What the developer should think about:** <specific questions or angles the
developer should consider — this feeds the Socratic questioning in Phase 3>

**Tier:** <Tier 3 (hard gate — cannot skip) | Tier 2 (can skip but flagged)>

(repeat for each problem-framing critique item)

### Technology Critique Items

| #   | Severity | Decision made      | Source artifact  | Alternative(s)       | Trade-offs                     | Why this matters           |
| --- | -------- | ------------------ | ---------------- | -------------------- | ------------------------------ | -------------------------- |
| 1   | HIGH     | <what was decided> | <which artifact> | <named alternatives> | <concrete trade-offs for each> | <why the user should care> |
| 2   | MEDIUM   | <what was decided> | <which artifact> | <named alternatives> | <concrete trade-offs for each> | <why the user should care> |

### Detail per Item

#### Item 1: <short title>

**Decision:** <what the planning subagent decided>

**Why this looks like a default choice:** <evidence — e.g., "Express was
chosen without justification. The project already uses Fastify for its
existing API endpoints.">

**Alternatives:**

| Option          | Pros (for this project) | Cons (for this project) |
| --------------- | ----------------------- | ----------------------- |
| <chosen>        | <concrete pros>         | <concrete cons>         |
| <alternative 1> | <concrete pros>         | <concrete cons>         |
| <alternative 2> | <concrete pros>         | <concrete cons>         |

**What would need to be true for <chosen> to be the right call:**
<specific conditions>

**What would need to be true for <alternative> to be better:**
<specific conditions>

**Web search findings:**

- <source>: <key finding, paraphrased>
- <source>: <key finding, paraphrased>

(repeat for each critique item)

### Items NOT Raised (if re-critique)

- <list any concerns from prior iterations that were already resolved by user decisions — do not re-raise these>

### Summary

- **Total critique items:** <N> (problem-framing: <N>, technology: <N>)
- **Problem-framing — HIGH (Tier 3):** <N>
- **Problem-framing — MEDIUM (Tier 2):** <N>
- **Problem-framing — LOW (Tier 2):** <N>
- **Technology — HIGH severity:** <N>
- **Technology — MEDIUM severity:** <N>
- **Technology — LOW severity:** <N>
- **Items skipped (prior decisions):** <N>
