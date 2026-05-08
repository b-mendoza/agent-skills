# Task Planner Template

Read this file only when assembling the stage 1 plan. Keep every heading even
when content is sparse; explain gaps instead of removing sections.

```markdown
# <ISSUE_SLUG> - Detailed Task Plan

> Source: docs/<ISSUE_SLUG>.md
> Generated on: <YYYY-MM-DD HH:MM UTC>

## Issue Summary

<3-5 sentence summary of the issue goal, scope, and key constraints.>

## Problem Framing

### End User

<Who the end user is. If the issue does not state this, write: "Not stated in issue - requires developer input.">

### Underlying Need

<The user problem or need this issue addresses. Mark inferred content clearly.>

### Proposed Solution

<The solution the issue prescribes.>

### Solution-Problem Fit

<How directly the proposed solution addresses the underlying need; include gaps and assumptions.>

### Alternative Approaches Not Explored

<Other ways the underlying need could be met. "None identified" is acceptable for tightly scoped fixes.>

### Evidence Basis

<Evidence cited for the solution. If none, write: "Not stated in issue - requires developer input.">

## Assumptions and Constraints

1. <Assumption or constraint.>
2. <Assumption or constraint.>

## Cross-Cutting Open Questions

1. **<Question>** - <Why it matters and fallback if unanswered.>

## Tasks

### Task A: <Short descriptive title>

**Objective:**
<One to two sentences on what this task accomplishes.>

**Relevant requirements and context:**
<Only the requirements, constraints, and background needed for this task.>

- Traces to: <Specific description, acceptance criteria, comment, child issue, or linked issue source.>

**Questions to answer before starting:**
<Uncertainties, why they matter, and fallback if unanswered. If none, write `None`.>

**Implementation notes:**
<Expected approach, boundaries, and technical considerations. If the codebase is unknown, describe what to look for.>

**Definition of done:**
- [ ] <Concrete verifiable outcome.>

**Likely files / artifacts affected:**
<Files, modules, or systems. If unknown, write `Unknown - requires codebase exploration`.>

### Task B: <Short descriptive title>

...

## Notes

<Plan observations, ambiguity, task-count exceptions, existing child-issue mapping, or current-child-issue scope note.>
```
