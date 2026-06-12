# External References for `council-of-advisors`

These references are relevant comparisons or background sources for the skill's actual design: independent specialist seats, reversibility classification, adversarial review, prior-art checks, multi-agent orchestration, dissent preservation, and decision-quality synthesis. They are not required runtime dependencies for the skill.

Last checked: 2026-06-11.

## Multi-Agent Orchestration

- [CrewAI Documentation](https://docs.crewai.com/)  
  CrewAI documents collaborative AI agents, crews, flows, guardrails, memory, and structured workflows. It is relevant because `council-of-advisors` uses a coordinator-plus-specialized-seats pattern: the orchestrator routes work while independent seats contribute bounded packets.

- [CrewAI Introduction](https://docs.crewai.com/en/introduction)  
  CrewAI's introduction distinguishes Flows, which manage state and control execution, from Crews, which are teams of agents delegated complex work. This maps closely to the council skill's orchestrator/seat split, though the council is intentionally stricter about seat isolation before synthesis.

- [Microsoft AutoGen publication: "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation"](https://www.microsoft.com/en-us/research/publication/autogen-enabling-next-gen-llm-applications-via-multi-agent-conversation-framework/)  
  AutoGen is a research-backed multi-agent framework for composing agents, human input, tools, and conversation patterns. It is relevant as a general-purpose counterpart to the council's fixed nine-seat deliberation architecture.

- [Microsoft Agent Framework migration guide from AutoGen](https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-autogen/)  
  This guide compares event-driven teams, graph workflows, group chat, concurrent agents, and manager-led orchestration. It is especially relevant to the council's choice to avoid broadcasted sibling context and instead route explicit packets to a chair.

- [LangGraph workflows and agents guide](https://docs.langchain.com/oss/python/langgraph/workflows-agents)  
  LangGraph documents workflow patterns such as prompt chaining, routing, parallelization, orchestrator-worker, and evaluator-optimizer flows. The council skill resembles a routed, parallel orchestrator-worker workflow with validation and repair gates.

- [OpenReview: "Can LLM Agents Really Debate? A Controlled Study of Multi-Agent Debate in Logical Reasoning"](https://openreview.net/forum?id=qsKo9mdGNu)  
  This 2026 paper studies multi-agent debate design factors, including team composition, confidence visibility, debate order, and debate depth. It is relevant because the council's design treats independence and dissent preservation as quality controls rather than relying on majority vote.

## Decision and Mental-Model Sources

- [Amazon 2016 Letter to Shareholders: High-Velocity Decision Making](https://www.aboutamazon.com/news/company-news/2016-letter-to-shareholders)  
  Bezos describes reversible "two-way door" decisions and lighter-weight processes for them. This is directly relevant to the `reversibility-seat`, which classifies decisions as Type 1 or Type 2 and sets downstream analysis depth.

- [Gary Klein: Pre-Mortem Method of Risk Assessment](https://www.gary-klein.com/premortem)  
  Klein's page describes imagining a plan has failed and generating likely threats before execution. This is relevant to the `adversary-seat`, which uses inversion and, in deep mode, writes a failure post-mortem.

- [Harvard Business Review: "Performing a Project Premortem"](https://hbr.org/2007/09/performing-a-project-premortem)  
  Klein's HBR article is relevant background for the skill's adversarial and dissent-friendly posture: the council intentionally makes reservations visible before the user commits.

- [Farnam Street: Mental Models](https://fs.blog/mental-models/)  
  Farnam Street's mental-model library includes second-order thinking and inversion, both of which appear as explicit council seats or seat techniques. It is relevant as a broad external mental-model catalog comparable to the skill's bundled `mental-models.md`.

- [Strategic Decisions Group: Decision Quality](https://sdg.com/decision-quality/)  
  SDG describes decision quality as a structured, collaborative approach for major decisions, including involving the right people at the right time. It is relevant to the council's emphasis on framing, multiple perspectives, evidence quality, and final recommendation quality.

## Related Techniques

- [The Uncertainty Project: Pre-Mortem](https://www.theuncertaintyproject.org/tools/pre-mortem)  
  This page summarizes premortem analysis as prospective hindsight for identifying risks before a project fails. It is relevant as an accessible counterpart to the adversary seat's failure-mode and pre-mortem behavior.

- [Decision Professionals: Decision Quality](https://www.decisionprofessionals.com/who-we-are/decision-quality)  
  This resource frames decision quality around shared elements such as framing, alternatives, information, values, reasoning, and commitment. It is relevant to the chair seat's role in integrating evidence, disagreements, values, and recommendation confidence.

## Notes on Fit

- These references are comparable resources, not source files for the skill. The authoritative behavior remains the local `council-of-advisors` package.
- No external reference found here exactly matches the skill's full contract of nine named mental-model seats, strict pre-synthesis seat isolation, originality branching, Type 1 low-confidence override, and educate-me lesson output. The closest matches are multi-agent orchestration frameworks plus decision-quality and premortem methods.
