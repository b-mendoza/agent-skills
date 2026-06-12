# Mermaid Style Guide

Load this file when writing or repairing Mermaid. If syntax details are
uncertain, fetch the official Mermaid flowchart documentation listed in
`external-sources.md`.

## Local Rules

- Default to `flowchart TD`; use `LR` only when a horizontal lifecycle is clearer.
- Prefer short uppercase node IDs and readable labels.
- Shape starts and terminals as rounded nodes, process steps as rectangles, and
  decisions as diamonds.
- Label decision edges explicitly: `yes`, `no`, `approved`, `declined`,
  `blocked`, or `needs input`.
- Use one edge per line in complex flows.
- Quote labels with punctuation that may confuse Mermaid parsing.
- Avoid lowercase `end` as a node label.
- Avoid node IDs that accidentally create special edge markers after arrows.
- Assign classes only to nodes that exist.
- During repair or refinement, change the smallest Mermaid surface that fixes the
  failed check and stays inside approved scope.

## Class Palette

```mermaid
classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
classDef human fill:#f3e8ff,stroke:#6f42c1,color:#000;
classDef output fill:#e8f5e9,stroke:#2e7d32,color:#000;
classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000;
classDef refine fill:#fff3cd,stroke:#856404,color:#000;
classDef stop fill:#fdecea,stroke:#b02a37,color:#000;
```

## Minimal Pattern

```mermaid
flowchart TD
  START([Start]) --> BOUNDARY[State authority and boundary]
  BOUNDARY --> CHECK{Evidence available?}
  CHECK -->|yes| VALIDATE[Run validation checks]
  CHECK -->|no| BLOCKED([Blocked: missing evidence])
  VALIDATE --> READY{Ready?}
  READY -->|yes| REPORT[Draft output]
  READY -->|no| REFINE([Needs refinement])
  REPORT --> DONE([Ready])

  class CHECK,READY decision;
  class VALIDATE check;
  class REPORT output;
  class DONE success;
  class REFINE,BLOCKED stop;
```
