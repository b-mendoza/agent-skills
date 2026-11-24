# Parallel units

## Card and ownership

- Use a serial card if the VCS baseline cannot supply the C1 changed-path listing.
- Partition the file map into 2–4 units (`U1` through `U4`). Give every file exactly one owner; assign both paths of a move to the same unit.
- List each unit’s steps, paths and operations. Its `MUTATION_LIMITS` permit only those edits, excluding operations reserved for the serial tail.
  Give each dispatch its own report path.
- List the names, paths, signatures and string-referenced paths used by files outside each unit. Freeze them throughout unit work, including lookups or patches by string.
- Put steps that change a frozen interface in the serial tail, along with documentation steps describing more than one unit.
  Keep documentation after the code it describes.

## Writers and evidence

- Before dispatching any writer, the orchestrator runs the exact `safe` contract once by the [C2 method](./claims-and-disputes.md) and records its result.
  Skip non-`safe` contracts and warning paths. Pass this checkpoint (`skipped` if it did not run or an amendment changed the command) to every writer of the run, including a serial continuation (`Unit: all`); none repeats it.
- Each unit inspects and edits its own files and validates its own report. It runs no repository-wide command, test, typecheck, formatter or other repository validation, even on just its files.
- Unit reports identify only their own edits. `PASS` means approved unit work completed, not that validation passed.
- At the join, use C1 to compare the baseline-relative name-only listing (including new files) with the union of reported edits, and each reported path with its assigned owner.
  Hold invalid reports (including a `Unit` mismatch) until every writer settles; then reconcile and stop `BLOCKED`.
  Do not infer authorship from a shared listing alone.
- The first writer after the join checks the frozen interfaces against the baseline before its first edit: the integration writer, or a serial continuation, to which the orchestrator passes the original card’s frozen-interface list because amendments do not carry `D-parallel` forward. Cite the pre-tail evidence under `Reviewer focus` where a later edit would obscure it.
- As sole writer, the integration writer applies only the approved tail, then runs the accepted contract once (no command on a warning path), even if the tail was empty.
  Use the latest contract evidence from `Unit: integration` or a serial continuation (`Unit: all`). C2 never applies to the numbered unit reports.
