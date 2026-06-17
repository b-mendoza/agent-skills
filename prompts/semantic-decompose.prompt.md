<task>
  Semantically decompose an entire skill package into a set of contract maps: one decomposed file per source file (the main skill file and every subagent file), so that a future agent can holistically understand the whole package without reading the originals.
</task>

<scope>
  <in_scope>
    - Read the skill package located at the user-provided path.
    - Identify the main skill file and every subagent file in the package.
    - Produce one decomposed output file per source file, written under the user-provided output directory.
    - Exhaustively enumerate every section and every contract defined in each source file.
  </in_scope>
  <out_of_scope>
    - Modifying, reformatting, moving, or deleting any file inside the source skill package.
    - Producing a single combined file that represents the whole package.
    - Decomposing files that are neither the main skill file nor a subagent file (for example references/ or scripts/), beyond listing them as inventory context.
    - Inventing, judging, improving, or redesigning any contract the source does not define.
  </out_of_scope>
</scope>

<goal>
  A reader of the output directory can reconstruct, in full, what the skill package and each of its subagents promise to do (inputs, outputs, flows, statuses, rules, gates, escalation) without opening the original files.
</goal>

<philosophy>
  <core_principle>You are a cartographer. You map every section and contract of the source to a semantic unit of work; you do not redesign the territory.</core_principle>
  <what_it_means>Faithfully record what each file currently defines, preserving its exact terminology, structure, and intent.</what_it_means>
  <what_it_does_NOT_mean>It does not mean summarizing, paraphrasing detail away, merging files, or proposing changes to the skill.</what_it_does_NOT_mean>
  <rule_of_thumb>If a future subagent could not reproduce a contract from your decomposed file, you have not been exhaustive enough.</rule_of_thumb>
</philosophy>

<phases>
  <phase id="1" name="gather-inputs" mode="interactive">
    <purpose>Establish what to decompose and where to write the output.</purpose>
    <steps>
      <step id="1.1">Ask the user for the skill package path (SKILL_PACKAGE_PATH) and the output directory name (OUTPUT_DIR). Ask for both in a single turn.</step>
      <step id="1.2">Confirm SKILL_PACKAGE_PATH resolves and contains a main skill file.</step>
    </steps>
    <gate>Do not proceed past this phase until both SKILL_PACKAGE_PATH and OUTPUT_DIR are supplied and the path resolves.</gate>
  </phase>

  <phase id="2" name="inventory" mode="read-only">
    <purpose>Build the strict 1:1 source-to-output mapping before writing anything.</purpose>
    <steps>
      <step id="2.1">Locate the main skill file and every subagent file in the package.</step>
      <step id="2.2">Record any other files (references, scripts, supporting assets) as inventory context only, not as decomposition targets.</step>
      <step id="2.3">Define exactly one decomposed output file per source file. Never collapse multiple source files into one output file.</step>
    </steps>
    <output>A file inventory listing each source file and the planned decomposed output file it maps to.</output>
  </phase>

  <phase id="3" name="decompose" mode="read-only-source">
    <purpose>Produce one exhaustive contract map per source file.</purpose>
    <steps>
      <step id="3.1">Read the full source file.</step>
      <step id="3.2">Enumerate every section and every contract: identity and role, inputs, outputs and output format, flows and pipelines, statuses, registries, resource and loading policies, instructions and steps, phases, gates, hard rules, constraints, escalation, success criteria, examples, and any other defined commitment.</step>
      <step id="3.3">For each contract, preserve the source's exact terminology and cite the source section it came from.</step>
      <step id="3.4">Write the decomposed file under OUTPUT_DIR, named to clearly correspond to its source file.</step>
    </steps>
    <output>One decomposed contract map per source file, written under OUTPUT_DIR.</output>
    <hard_rule>Be exhaustive: list every contract, never a representative subset.</hard_rule>
  </phase>

  <phase id="4" name="verify" mode="read-only">
    <purpose>Confirm completeness of the mapping before reporting done.</purpose>
    <steps>
      <step id="4.1">Confirm every source file (the main skill file and each subagent file) has exactly one decomposed output file.</step>
      <step id="4.2">Confirm no source file was skipped and no single combined file was produced.</step>
      <step id="4.3">Spot-check that each decomposed file's contracts trace back to its source.</step>
    </steps>
    <output>A short coverage report mapping each source file to its decomposed output file.</output>
  </phase>
</phases>

<anti_patterns>
  Do NOT:
  - Write a single file that contains the whole skill package; produce one decomposed file per source file.
  - Summarize, abbreviate, or omit contracts; the enumeration must be exhaustive.
  - Modify, reformat, move, or delete any file inside the source skill package.
  - Invent contracts, or improve, critique, or redesign the skill.
  - Skip any subagent file, or merge multiple source files into one output file.
</anti_patterns>

<ambiguity_handling>
  If it is unclear whether a given file is a subagent file, record it in the inventory with your reasoning and ask the user before decomposing it, rather than guessing silently.
</ambiguity_handling>

<constraints scope="all-phases">
  <constraint id="1" name="source-read-only">Treat the source skill package as read-only; write only inside OUTPUT_DIR.</constraint>
  <constraint id="2" name="one-to-one-mapping">Maintain a strict 1:1 mapping from each source file to one decomposed output file.</constraint>
  <constraint id="3" name="preserve-terminology">Preserve the source's exact terminology for every contract.</constraint>
  <constraint id="4" name="exhaustive">Enumerate every section and contract; favor completeness over brevity.</constraint>
</constraints>

<success_criteria>
  - Every source file (the main skill file and each subagent file) has exactly one corresponding decomposed file in OUTPUT_DIR.
  - No single combined file represents the whole package.
  - Each decomposed file exhaustively enumerates every section and contract of its source, with source citations.
  - No file inside the source skill package was modified, moved, or deleted.
  - A coverage report maps each source file to its decomposed output file.
  - Terminology in the decomposed files matches the source verbatim.
</success_criteria>
