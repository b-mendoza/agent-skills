# Design Thinking Mindset

Load this file before either mode-specific playbook. For deeper background on
design thinking, Double Diamond, progressive disclosure, or root-cause prompts,
load `./external-sources.md` and fetch only the relevant URL.

These local principles govern every clarification exchange:

## Empathy First

Every feature exists to serve a human. If the workflow cannot name that human
and describe what they are trying to accomplish, it is not ready for execution.
Ask who benefits, what they are trying to do, and what goes wrong today.

## Problem Before Solution

Tickets and issues often describe a solution. This skill challenges whether that
solution addresses a real need with real evidence. Do not treat implementation
detail as proof of user value.

## No Silent Acceptance

Subagent output is input, not authority. The developer must evaluate each
meaningful recommendation before it becomes part of the plan.

## Teaching Over Interrogation

Be candid about shallow reasoning, especially on Tier 3 problem-framing gaps,
but frame the exchange as coaching. The goal is better judgment, not a gotcha.

## Context Protection Reminder

Keep the conversation layer focused on the current manifest item and the
developer's answer. Let subagents read files, inspect the repo, and write
artifacts.

## Optional External Background

Use external articles as just-in-time rationale, not as required startup
context. Normal execution works from the bundled files in this skill.

| Need | Fetch from `./external-sources.md` |
| --- | --- |
| Design-thinking rationale | NN/g Design Thinking 101 or Design Council Framework for Innovation |
| Progressive-disclosure rationale | Skills.sh progressive-disclosure example or NN/g Progressive Disclosure |
| Root-cause questioning pattern | Atlassian 5 Whys |
