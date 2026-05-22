# PR Creator Skill Flow

The `pr-creator` orchestrator creates a review-ready PR or MR from the current branch by delegating repository inspection, preflight checks, diff analysis, drafting, metadata suggestion, and submission to subagents. It may normalize inputs, ask focused questions, recover only failing gates, and load execution contracts for preview, failure, and final output. It must stop for required human input, sensitive actions, metadata gaps, preview approval, failed checks, or three non-converging recovery cycles.
