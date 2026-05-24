# Prompt Structurer Workflow

Prompt Structurer is a routing orchestrator: it captures `PROMPT_TEXT` and optional run context, chooses the smallest useful flow, dispatches bundled analysis passes in order, and returns the final XML prompt plus assembly notes. It trusts user-provided prompt text, terminology, suite context, and change requests as source of truth; subagent outputs are analysis artifacts. It may read local skill files and optional references as needed, but it must not invent scope, rename terminology without request, or mutate an existing structured prompt beyond the requested revision.

```mermaid
flowchart TD
  START([Start: Prompt Structurer request]) --> INTAKE["Capture PROMPT_TEXT, RUN_STYLE, SUITE_CONTEXT, TERMINOLOGY, CHANGE_REQUEST"]
  INTAKE --> HAVE_PROMPT{"PROMPT_TEXT present?"}
  HAVE_PROMPT -->|no| BLOCKED([BLOCKED: request missing required PROMPT_TEXT])
  HAVE_PROMPT -->|yes| CONTRADICTION{"Contradictory rules change task meaning?"}
  CONTRADICTION -->|yes| FAIL([FAIL: ask targeted clarification before contract assembly])
  CONTRADICTION -->|no| WEB_NEED{"Need source-backed or current external rationale?"}

  WEB_NEED -->|no| SELECT{"Select smallest useful flow"}
  WEB_NEED -->|yes| WEB_APPROVAL{"Human approves targeted web fetch?"}
  WEB_APPROVAL -->|approved| WEB_FETCH["Fetch smallest relevant URL and record resource"]
  WEB_APPROVAL -->|declined| LOCAL_ONLY["Use local-only fallback or mark rationale omitted"]
  WEB_FETCH --> SELECT
  LOCAL_ONLY --> SELECT

  SELECT -->|light| LIGHT["Light: short one-shot, low autonomy risk"]
  SELECT -->|full| FULL["Full: multi-phase, autonomous, safety-sensitive, or failing"]
  SELECT -->|suite| SUITE["Suite: align with shared suite conventions"]
  SELECT -->|revision| REVISION["Revision: existing XML prompt with targeted change"]

  LIGHT --> P1L["Pass 1: semantic-decomposer"]
  P1L --> P6L["Pass 6: xml-prompt-assembler"]

  FULL --> P1F["Pass 1: semantic-decomposer"]
  SUITE --> SUITE_CTX["Pass SUITE_CONTEXT and shared blocks into every pass"]
  SUITE_CTX --> P1F
  P1F --> P2["Pass 2: philosophy-constraints-classifier"]
  P2 --> P3["Pass 3: implicit-behavior-surfacer"]
  P3 --> P4["Pass 4: anti-pattern-synthesizer"]
  P4 --> P5["Pass 5: success-criteria-builder"]
  P5 --> P6F["Pass 6: xml-prompt-assembler"]

  REVISION --> REV_SCOPE{"Change limited to CHANGE_REQUEST?"}
  REV_SCOPE -->|yes| AFFECTED["Dispatch only affected analysis pass(es) in pipeline order"]
  REV_SCOPE -->|no| REV_ESCALATE([BLOCKED: reject or clarify out-of-scope revision change])
  AFFECTED --> P6R["Pass 6: xml-prompt-assembler"]

  P6L --> CHECK["Check run-level success criteria"]
  P6F --> CHECK
  P6R --> CHECK

  CHECK --> PASSES{"Criteria pass?"}
  PASSES -->|yes| OUTPUT["Return final XML prompt first, then assembly notes"]
  PASSES -->|no| REPAIR{"Repair cycles remaining?"}
  REPAIR -->|yes| FIX["Fix only failed checks and rerun relevant pass"]
  FIX --> P6R
  REPAIR -->|no| REPAIR_NEEDED([repair-needed: stop after three targeted cycles])

  OUTPUT --> NOTES["Assembly notes: assumptions, omitted sections, resources fetched, web approval or local-only fallback, follow-ups"]
  NOTES --> DONE([PASS])
```
