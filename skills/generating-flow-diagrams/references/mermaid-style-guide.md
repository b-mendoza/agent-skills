# Mermaid Style Guide

> Load this file when writing or repairing Mermaid. If current syntax details are
> uncertain, fetch the Mermaid source listed in `external-sources.md`.

## Local Rules

- Default to `flowchart TD`; use `LR` only when a horizontal lifecycle is clearer.
- Prefer short uppercase node IDs and readable labels, such as `VERIFY_CLAIMS`.
- Shape starts and terminals as rounded nodes, process steps as rectangles, and decisions as diamonds.
- Label decision edges explicitly: `yes`, `no`, `approved`, `declined`, `blocked`, or `needs research`.
- Prefer one edge per line when the flow is complex.
- Quote labels with punctuation that may confuse Mermaid parsing.
- Avoid node IDs that accidentally start a special edge form, such as `o` or `x` immediately after an edge marker.
- Avoid lowercase `end` as a node label.
- Assign classes only to nodes that exist; avoid duplicate conflicting node definitions.

## Class Palette

Use a compact palette like this when styling helps readability:

```mermaid
classDef guard fill:#fff3cd,stroke:#856404,color:#000;
classDef check fill:#e7f1ff,stroke:#0b5ed7,color:#000;
classDef decision fill:#f8f9fa,stroke:#495057,color:#000;
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
  class REFINE refine;
  class BLOCKED stop;
```
