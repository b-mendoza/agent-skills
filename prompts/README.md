# Prompts (current state)

> **Short-lived reference.** This file describes the current prompt families on disk and the rules for adding new ones. Update it in the same change that adds, moves, or removes a family. If this file and the tree disagree, the tree wins — fix this file.

`prompts/` is a first-class repository tree. It holds reusable executable prompts and the contracts or supporting docs they need. Generated run output does not belong here.

## Current families

| Family | Contents |
| --- | --- |
| [`scouting-to-improvement/`](./scouting-to-improvement/) | Two-phase skill scouting and rewrite workflow. See the [family README](./scouting-to-improvement/README.md). |
| [`semantic-decomposition/`](./semantic-decomposition/) | Single prompt that creates contract maps for the main SKILL.md and subagent files while inventorying references/scripts. |
| [`best-practices-audit/`](./best-practices-audit/) | Single read-only prompt that audits `docs/best-practices/` as a corpus and writes a four-file dossier under a caller-supplied safe `OUTPUT_DIR` outside `prompts/` and other protected trees. |

### scouting-to-improvement

| File | Role |
| --- | --- |
| [`scouting-phase.prompt.md`](./scouting-to-improvement/scouting-phase.prompt.md) | Executable prompt. Cartograph one first-party skill and research public skills. |
| [`improving-skill-phase.prompt.md`](./scouting-to-improvement/improving-skill-phase.prompt.md) | Executable prompt. Assess a scouting dossier, propose a rewrite, and apply an approved manifest. |
| [`scouting-handoff-contract.md`](./scouting-to-improvement/scouting-handoff-contract.md) | Supporting contract. Three-file dossier interface between the phases. |
| [`README.md`](./scouting-to-improvement/README.md) | Family workflow notes. |

Hardcoded contract path used by both executable prompts: `prompts/scouting-to-improvement/scouting-handoff-contract.md`.

Phase 1 writes under `outputs/scouting-phase-{skill-name}/`. Phase 2 writes under `outputs/improving-skill-phase-{skill-name}/`. Those directories stay outside `prompts/`.

### semantic-decomposition

| File | Role |
| --- | --- |
| [`semantic-decompose.prompt.md`](./semantic-decomposition/semantic-decompose.prompt.md) | Executable prompt. Creates contract maps for the main SKILL.md and subagent files while inventorying references/scripts. |

The prompt writes only under the user-supplied `OUTPUT_DIR`, which must remain outside `prompts/`.

### best-practices-audit

| File | Role |
| --- | --- |
| [`audit.prompt.md`](./best-practices-audit/audit.prompt.md) | Executable prompt. Read-only adversarial audit of `docs/best-practices/` as a corpus. |

The prompt writes only the four dossier files `INDEX.md`, `inventory.md`, `findings.md`, and `compliance.md` under the user-supplied `OUTPUT_DIR`, which must remain outside `prompts/` and other protected trees. Suggested location: `outputs/best-practices-audit-{date-or-run-id}/`.

## Rules for adding a prompt family

1. Every prompt belongs in a descriptive kebab-case family directory. Do not add executable prompts or contracts as loose files at `prompts/`.
2. Related executable prompts, contracts, and supporting docs stay together in that family directory.
3. Executable prompts keep the `.prompt.md` suffix. Supporting docs (contracts, notes, indexes) use `.md`.
4. Add a family `README.md` when the family is a multi-file workflow. A single-file family may omit it.
5. Update this catalog and every hardcoded or documented path that points at the family in the same change.
6. Generated outputs remain outside `prompts/`. Write run artifacts under `outputs/` or another caller-supplied directory that is not this tree.
