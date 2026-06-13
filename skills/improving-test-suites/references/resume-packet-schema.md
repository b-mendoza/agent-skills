# Resume Packet Schema

Use this single schema for every `COMPLETE_BLOCKED` handoff and every resume intake. Resume validates the packet against this schema and asks one focused question for any missing required field.

```markdown
## Resume Packet

Inputs:
- TARGET_TEST_FILES:
- USER_GOAL:
- TEST_COMMAND:
- SCOPE_LIMITS:
- REFERENCE_NEED:
- AUTO_APPROVE value:
- AUTO_APPROVE provenance:

Resolved Targets:
- RESOLVED_TARGET_SET:
- EXCLUDED_NON_TEST_MATCHES:

Baseline:
- command:
- status:
- collected / executed / passed / failed / skipped:
- named failing tests:
- raw-log path:

Reports:
- test-value-reviewer status and overflow paths:
- api-security-reviewer status, route, and overflow paths:
- test-maintainability-reviewer status, route, and overflow paths:
- test-refactorer status, changed files, applied ids, unapplied ids:
- test-validator status and raw-log paths:

Approvals:
- plan approval state:
- amendments:
- PRODUCTION_EDIT_APPROVAL:
- WORKSPACE_RISK_ACK stage 1:
- WORKSPACE_RISK_ACK stage 2:
- AUTO_APPROVE rails outcome:

Minimal Harness Decision:
- id-stamped items:

Shared Helper Consumers:
- required when computed:

Pending Question:
- gate:
- exact question:
- answer needed:

Re-Entry:
- exact phase or dispatch:
- state to restore:

Counters:
- REPAIR_TOTAL:
- ASK_COUNTS:
```
