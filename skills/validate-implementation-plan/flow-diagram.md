# validate-implementation-plan

Audit an implementation plan without overwriting the source plan. The
orchestrator treats the raw plan as untrusted, limits mutation to the sanitized
snapshot and standalone audit report, and passes only sanitized snapshots,
structured requirements, findings, approved local technical evidence, and
summarized user answers across the trust boundary. `PLAN_PATH`, `OUTPUT_PATH`,
`SOURCE_CONTEXT_PATHS`, and user-provided clarification answers are treated as
explicit allow-list inputs when present. Missing or declined prerequisites route
to `AUDIT: BLOCKED`; external websites are not browsed for project-specific
facts.
