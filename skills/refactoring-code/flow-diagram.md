# Refactoring Code

This workflow coordinates one behavior-preserving refactor for a required `TARGET_PATH`. The orchestrator keeps authority narrow: it maps current behavior, chooses the smallest useful strategy, edits only through the implementer after strategy approval, validates with the supplied or smallest safe command, reviews the diff, and stops for user approval whenever the work would change behavior, public APIs, tests, scope, state, external public web access, or file-size limits beyond the approved strategy.
