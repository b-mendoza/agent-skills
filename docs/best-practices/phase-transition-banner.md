# phase-transition-banner

## Tier

`optional-style`. The banner shape is a repo UI convention, not a
cross-runtime requirement. The underlying rule — make phase
transitions visible — is recommended; the specific banner format is
style.

## When it applies

When a multi-phase orchestrator wants to make each phase transition
visible before the new phase begins.

## The practice

Multi-phase orchestrators make each phase transition visible before
the new phase starts. In this repo, the preferred marker is the
forty-hyphen banner:

```text
----------------------------------------
Phase <N>/<TOTAL> - <Phase name>
----------------------------------------
```

The forty-hyphen banner is a repo UI convention, not a cross-runtime
requirement. If the host UI has a native progress marker, use that
while preserving the same information: phase number, total phase
count, phase name, and scope when relevant. Subagents do not emit
phase markers.

## Rationale

Phase transitions are the load-bearing observable points in a multi-
phase workflow: when a user looks at the running output and asks
"what is the orchestrator doing now," the answer should be in the
output, not inferred from tool-call traces. The banner gives the
user a visible marker at the moment the orchestrator changes phase,
so any later question ("did it reach Phase 5?") has a textual
answer.

The "subagents do not emit" rule keeps the banner from becoming
noise. If every dispatched subagent emits its own phase banner, the
banners collapse into background and stop signaling. Reserving them
for orchestrator phase changes preserves their signal value.

The `optional-style` tier reflects that the specific format — forty
hyphens, the `Phase N/TOTAL - Name` line, the exact spacing — is a
repo UI choice. The underlying rule of visible phase transitions is
covered by `phase-execution-cycle`.

## Concrete examples

Good: the orchestrator emits the banner before each phase action.

```text
----------------------------------------
Phase 4/8 - Audit
----------------------------------------
Dispatching focused audit slices...
```

Good (host-native variant): a runtime with native progress UI shows
the same information via its own marker.

```text
[Phase 4/8 — Audit] Dispatching focused audit slices...
```

Bad: no transition marker; the user cannot tell when the orchestrator
moved phases.

```text
Dispatching focused audit slices...
(Phase 4 silently elapsed in the middle of a log block; reader has
to count tool calls to know which phase the orchestrator is in.)
```

Bad: every dispatched subagent emits its own banner, defeating the
signal.

```text
----------------------------------------
Phase 4/8 - Audit
----------------------------------------
----------------------------------------
Phase 4/8 - Audit
----------------------------------------
flow-coherence-auditor: starting...
----------------------------------------
Phase 4/8 - Audit
----------------------------------------
subagent-architecture-auditor: starting...
```

## References

- Nielsen Norman Group, "Progress Indicators Make a Slow System Less
  Insufferable," accessed 2026-06-03:
  <https://www.nngroup.com/articles/progress-indicators/>. Supports
  visible progress markers as a UI primitive.
- BBC GEL, "Progress disclosure pattern," accessed 2026-06-03:
  <https://www.bbc.co.uk/gel/guidelines/progress-indicator>.
  Supports the principle that long-running multi-phase work needs
  explicit phase indicators.
