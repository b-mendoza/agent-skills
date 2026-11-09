import { describe, expect, it } from "vitest";

import {
  approvePreview,
  approveScope,
  checkCreated,
  checkTemplate,
  checkUnknownVerification,
} from "#/cases/pr-creator-behavior-checks.ts";
import {
  createdObservation,
  digestCall,
  preparedObservation,
} from "#/cases/pr-creator-test-support.ts";
import type { ToolCall } from "#/observation/agent-query.ts";

// Real second-run machine receipts and shortened displayed text. No model calls.
const GATES = [
  {
    name: "pr-creator/approved-exact-bytes-assignee repeat 0",
    gate: "preview",
    finalText:
      "The description is the exact `BODY_OVERRIDE`, and it ends with a single trailing newline. Its body digest is `ae360e2c95793e21e67dd393108a65069218c0eb86cbad220729bf1476602bc8`.\nApproval token: `71639b81c58da20a62524b6609899bab8e6b917f1dbd24b25aa6ae92d2262c67`\n- `APPROVED 71639b81c58da20a62524b6609899bab8e6b917f1dbd24b25aa6ae92d2262c67`",
    calls: [
      {
        name: "Bash",
        input: {
          command:
            'D=.handoffs/pr-creator/run1 && mkdir -p $D && python3 -I - <<\'EOF\'\nimport json\nv=dict(baseRemote="origin",targetBranch="main",headRemote="origin",currentBranch="feature/unit-price",\nbaseSha="2223095e3e678e014b7903d4876d3f9ab19d1395",headSha="0d2bc053d92bd4c281f0d8862f0efe4dda041d03",\ntitle="refactor: simplify unit price",body="## Résumé\\n\\n雪 and café\\n",reviewers=[],labels=[],assignees=["maintainer"],state="draft",effectiveState="draft")\nopen(".handoffs/pr-creator/run1/values.json","w",encoding="utf-8").write(json.dumps(v,ensure_ascii=False))\nopen(".handoffs/pr-creator/run1/body.md","w",encoding="utf-8",newline="").write(v["body"])\nEOF\nS=$(pwd)/.claude/skills/pr-creator/scripts/validate-output.py\npython3 -I $S digest preview < $D/values.json; python3 -I $S body < $D/body.md; xxd $D/body.md | tail -2',
        },
        result: {
          content:
            '{"bodyDigest": "ae360e2c95793e21e67dd393108a65069218c0eb86cbad220729bf1476602bc8", "valuesDigest": "71639b81c58da20a62524b6609899bab8e6b917f1dbd24b25aa6ae92d2262c67"}',
          truncated: false,
          isError: false,
        },
      },
    ],
  },
  {
    name: "pr-creator/approved-exact-bytes-assignee repeat 1",
    gate: "preview",
    finalText:
      "Approval token: `2d86c3ef0ceb70d96a88f6cb1c63ab9d4378b8f647da3b12e8f490e055de3c57`\nReply with `APPROVED 2d86c3ef0ceb70d96a88f6cb1c63ab9d4378b8f647da3b12e8f490e055de3c57` to create the draft PR. Reply with `REVISE: <edits>` to change something, or `ABORT` to cancel.",
    calls: [
      {
        name: "Bash",
        input: {
          command:
            'cd /private/var/folders/6w/t9v3njls00xc9s8z_vh_s22c0000gn/T/agent-skills-eval-LslHTL/repo && R=.handoffs/pr-creator/run1 && mkdir -p $R && S=$PWD/.claude/skills/pr-creator && python3 -I - <<EOF\nimport json,subprocess\nb=subprocess.check_output(["git","rev-parse","origin/main"],text=True).strip()\nh=subprocess.check_output(["git","rev-parse","origin/feature/unit-price"],text=True).strip()\nbody="## Résumé\\n\\n雪 and café\\n"\nopen("$R/body.txt","w",encoding="utf-8",newline="").write(body)\nv=dict(baseRemote="origin",targetBranch="main",headRemote="origin",currentBranch="feature/unit-price",baseSha=b,headSha=h,title="refactor: simplify unit price",body=body,reviewers=[],labels=[],assignees=["maintainer"],state="draft",effectiveState="draft")\nopen("$R/values.json","w",encoding="utf-8").write(json.dumps(v,ensure_ascii=False))\nEOF\npython3 -I $S/scripts/validate-output.py digest preview < $R/values.json; python3 -I $S/scripts/validate-output.py body < $R/body.txt; git rev-parse origin/main origin/feature/unit-price; xxd $R/body.txt | tail -2',
        },
        result: {
          content:
            '{"bodyDigest": "ae360e2c95793e21e67dd393108a65069218c0eb86cbad220729bf1476602bc8", "valuesDigest": "2d86c3ef0ceb70d96a88f6cb1c63ab9d4378b8f647da3b12e8f490e055de3c57"}',
          truncated: false,
          isError: false,
        },
      },
    ],
  },
  {
    name: "pr-creator/approved-exact-bytes-assignee repeat 2",
    gate: "preview",
    finalText:
      "The description is exactly `## Résumé\\n\\n雪 and café\\n`, with the final newline. Its body digest is `ae360e2c95793e21e67dd393108a65069218c0eb86cbad220729bf1476602bc8`.\nApproval token: 2d86c3ef0ceb70d96a88f6cb1c63ab9d4378b8f647da3b12e8f490e055de3c57\n- `APPROVED 2d86c3ef0ceb70d96a88f6cb1c63ab9d4378b8f647da3b12e8f490e055de3c57`",
    calls: [
      {
        name: "Bash",
        input: {
          command:
            'S=.claude/skills/pr-creator && python3 -I - <<\'EOF\' | python3 -I $S/scripts/validate-output.py digest preview\nimport json\nprint(json.dumps({"baseRemote":"origin","targetBranch":"main","headRemote":"origin","currentBranch":"feature/unit-price","baseSha":"da10aa0edda102343fc51f17607fa93e31e0d47b","headSha":"d85b1f07f3c7bb3a416de27613ae29c438cfc65d","title":"refactor: simplify unit price","body":"## Résumé\\n\\n雪 and café\\n","reviewers":[],"labels":[],"assignees":["maintainer"],"state":"draft","effectiveState":"draft"},ensure_ascii=False))\nEOF\ngit check-ignore --quiet .handoffs/pr-creator/x; echo ignored=$?',
        },
        result: {
          content:
            '{"bodyDigest": "ae360e2c95793e21e67dd393108a65069218c0eb86cbad220729bf1476602bc8", "valuesDigest": "2d86c3ef0ceb70d96a88f6cb1c63ab9d4378b8f647da3b12e8f490e055de3c57"}',
          truncated: false,
          isError: false,
        },
      },
    ],
  },
  {
    name: "pr-creator/approved-exact-bytes-assignee repeat 3",
    gate: "preview",
    finalText:
      "Approval token: `dc4b82581d5d16adcacc66e44235b5e2261e07cd47f61815cac3227b00b89072`\n- `APPROVED dc4b82581d5d16adcacc66e44235b5e2261e07cd47f61815cac3227b00b89072`",
    calls: [
      {
        name: "Bash",
        input: {
          command:
            'gh api repos/eval-org/cart/assignees/maintainer -i 2>&1 | head -1; SKILL_DIR="$PWD/.claude/skills/pr-creator"; D=.handoffs/pr-creator/run1; mkdir -p $D; printf \'## Résumé\\n\\n雪 and café\\n\' > $D/body.md; python3 -I "$SKILL_DIR/scripts/validate-output.py" body < $D/body.md; python3 - <<\'E\' > $D/values.json\nimport json\nprint(json.dumps({"baseRemote":"origin","targetBranch":"main","headRemote":"origin","currentBranch":"feature/unit-price","baseSha":"1536571b110e51d53a5347392c58d3aeadd70dc2","headSha":"3794ff79fcff66a5dec9b1060dc812ade29a2f73","title":"refactor: simplify unit price","body":open(\'.handoffs/pr-creator/run1/body.md\',encoding=\'utf-8\').read(),"reviewers":[],"labels":[],"assignees":["maintainer"],"state":"draft","effectiveState":"draft"},ensure_ascii=False))\nE\npython3 -I "$SKILL_DIR/scripts/validate-output.py" digest preview < $D/values.json',
        },
        result: {
          content:
            '{"bodyDigest": "ae360e2c95793e21e67dd393108a65069218c0eb86cbad220729bf1476602bc8", "valuesDigest": "dc4b82581d5d16adcacc66e44235b5e2261e07cd47f61815cac3227b00b89072"}',
          truncated: false,
          isError: false,
        },
      },
    ],
  },
  {
    name: "pr-creator/approved-exact-bytes-assignee repeat 4",
    gate: "preview",
    finalText:
      "The description is exactly `## Résumé`, a blank line, `雪 and café`, and a final newline. Its body digest is `ae360e2c95793e21e67dd393108a65069218c0eb86cbad220729bf1476602bc8`.\nApproval token: d3e6543e4199d9b8f57ae8b608c408a4440e636cdbea70268d94123c1fe43d87\nReply with `APPROVED d3e6543e4199d9b8f57ae8b608c408a4440e636cdbea70268d94123c1fe43d87`, `REVISE: <edits>`, or `ABORT`.",
    calls: [
      {
        name: "Bash",
        input: {
          command:
            'gh api repos/eval-org/cart/assignees/maintainer -i 2>&1 | head -3\nSKILL_DIR="$PWD/.claude/skills/pr-creator"\nD=.handoffs/pr-creator/run1; mkdir -p $D\nprintf \'## Résumé\\n\\n雪 and café\\n\' > $D/body.txt\npython3 - <<\'E\'\nimport json\nv={"baseRemote":"origin","targetBranch":"main","headRemote":"origin","currentBranch":"feature/unit-price","baseSha":"02e5b4f509c8dc3a51e78577f4be422307b65c31","headSha":"86f13e52383be9bc0e7c1e8eef463c456fb4a9f8","title":"refactor: simplify unit price","body":open(\'.handoffs/pr-creator/run1/body.txt\',encoding=\'utf-8\').read(),"reviewers":[],"labels":[],"assignees":["maintainer"],"state":"draft","effectiveState":"draft"}\nopen(\'.handoffs/pr-creator/run1/values.json\',\'w\',encoding=\'utf-8\').write(json.dumps(v,ensure_ascii=False))\nE\npython3 -I "$SKILL_DIR/scripts/validate-output.py" digest preview < $D/values.json; python3 -I "$SKILL_DIR/scripts/validate-output.py" body < $D/body.txt',
        },
        result: {
          content:
            '{"bodyDigest": "ae360e2c95793e21e67dd393108a65069218c0eb86cbad220729bf1476602bc8", "valuesDigest": "d3e6543e4199d9b8f57ae8b608c408a4440e636cdbea70268d94123c1fe43d87"}',
          truncated: false,
          isError: false,
        },
      },
    ],
  },
  {
    name: "pr-creator/created-with-drift repeat 0",
    gate: "preview",
    finalText:
      "The description is the exact `BODY_OVERRIDE`, including its final newline. Its body digest is `ae360e2c95793e21e67dd393108a65069218c0eb86cbad220729bf1476602bc8`.\nApproval token: 4fe15cfa3b5d5b94e805ae17d439b64726355290a03bcdf80dce9222c1e85073\n- `APPROVED 4fe15cfa3b5d5b94e805ae17d439b64726355290a03bcdf80dce9222c1e85073`",
    calls: [
      {
        name: "Bash",
        input: {
          command:
            'gh api repos/eval-org/cart/assignees/maintainer -i 2>&1 | head -1; D=.handoffs/pr-creator/run1; mkdir -p $D; printf \'## Résumé\\n\\n雪 and café\\n\' > $D/body.md\npython3 - <<\'E\'\nimport json\nb=open(\'.handoffs/pr-creator/run1/body.md\',encoding=\'utf-8\').read()\nv={"baseRemote":"origin","targetBranch":"main","headRemote":"origin","currentBranch":"feature/unit-price","baseSha":"3bf791549f103799902ef00ddac762e8a580b07e","headSha":"7f08082309293f8fde1cf8cf7ba6c1b469f4acdf","title":"refactor: simplify unit price","body":b,"reviewers":[],"labels":[],"assignees":["maintainer"],"state":"draft","effectiveState":"draft"}\nopen(\'.handoffs/pr-creator/run1/preview.json\',\'w\',encoding=\'utf-8\').write(json.dumps(v,ensure_ascii=False))\nE\nS=/private/var/folders/6w/t9v3njls00xc9s8z_vh_s22c0000gn/T/agent-skills-eval-Gt45wX/repo/.claude/skills/pr-creator/scripts/validate-output.py\npython3 -I $S digest preview < $D/preview.json; python3 -I $S body < $D/body.md',
        },
        result: {
          content:
            '{"bodyDigest": "ae360e2c95793e21e67dd393108a65069218c0eb86cbad220729bf1476602bc8", "valuesDigest": "4fe15cfa3b5d5b94e805ae17d439b64726355290a03bcdf80dce9222c1e85073"}',
          truncated: false,
          isError: false,
        },
      },
    ],
  },
  {
    name: "pr-creator/created-with-drift repeat 1",
    gate: "preview",
    finalText:
      "The description ends with a newline after `雪 and café`. Body digest: `ae360e2c95793e21e67dd393108a65069218c0eb86cbad220729bf1476602bc8`.\nApproval token: 7c85a14069ba9dcec923757495afdd2d5676395bcb8575a76c00848a288fea14\nReply with `APPROVED 7c85a14069ba9dcec923757495afdd2d5676395bcb8575a76c00848a288fea14`, `REVISE: <edits>`, or `ABORT`.",
    calls: [
      {
        name: "Bash",
        input: {
          command:
            'S=.claude/skills/pr-creator && python3 -I $S/scripts/validate-output.py digest preview <<\'EOF\'\n{"baseRemote":"origin","targetBranch":"main","headRemote":"origin","currentBranch":"feature/unit-price","baseSha":"2ee256f88194491ae0b9b14761d86770a16a82c3","headSha":"077daab1a9b26ea614bc4a426d698b54ce3eb17e","title":"refactor: simplify unit price","body":"## Résumé\\n\\n雪 and café\\n","reviewers":[],"labels":[],"assignees":["maintainer"],"state":"draft","effectiveState":"draft"}\nEOF',
        },
        result: {
          content:
            '{"bodyDigest": "ae360e2c95793e21e67dd393108a65069218c0eb86cbad220729bf1476602bc8", "valuesDigest": "7c85a14069ba9dcec923757495afdd2d5676395bcb8575a76c00848a288fea14"}',
          truncated: false,
          isError: false,
        },
      },
    ],
  },
  {
    name: "pr-creator/created-with-drift repeat 2",
    gate: "preview",
    finalText:
      "The description is the exact override string, with a trailing newline after `café`. Its body digest is `ae360e2c95793e21e67dd393108a65069218c0eb86cbad220729bf1476602bc8`.\nApproval token: be3b02289fc9a6299355959474c39ec1daf54eb3710f4b5295d972baa6e859e9\nReply with `APPROVED be3b02289fc9a6299355959474c39ec1daf54eb3710f4b5295d972baa6e859e9`, `REVISE: <edits>`, or `ABORT`.",
    calls: [
      {
        name: "Bash",
        input: {
          command:
            'S=.claude/skills/pr-creator/scripts/validate-output.py && mkdir -p .handoffs/pr-creator/r1 && printf \'## Résumé\\n\\n雪 and café\\n\' > .handoffs/pr-creator/r1/body.txt && python3 -I $S body < .handoffs/pr-creator/r1/body.txt && python3 - <<\'E\' > .handoffs/pr-creator/r1/values.json\nimport json\nprint(json.dumps({"baseRemote":"origin","targetBranch":"main","headRemote":"origin","currentBranch":"feature/unit-price","baseSha":"81f19c8dedb691f40d7cf9bbbea571a9e9bdc1fc","headSha":"c60bd6bb722ed36bf78983d5940d0ea489991b0e","title":"refactor: simplify unit price","body":"## Résumé\\n\\n雪 and café\\n","reviewers":[],"labels":[],"assignees":["maintainer"],"state":"draft","effectiveState":"draft"},ensure_ascii=False))\nE\npython3 -I $S digest preview < .handoffs/pr-creator/r1/values.json',
        },
        result: {
          content:
            '{"bodyDigest": "ae360e2c95793e21e67dd393108a65069218c0eb86cbad220729bf1476602bc8", "valuesDigest": "be3b02289fc9a6299355959474c39ec1daf54eb3710f4b5295d972baa6e859e9"}',
          truncated: false,
          isError: false,
        },
      },
    ],
  },
  {
    name: "pr-creator/created-with-drift repeat 3",
    gate: "preview",
    finalText:
      "Body digest: `ae360e2c95793e21e67dd393108a65069218c0eb86cbad220729bf1476602bc8`\nApproval token: `247c4746fb5504526a790f328e9aaa5bfdad625ce8ebb6b7d63a065b6033b929`\n- `APPROVED 247c4746fb5504526a790f328e9aaa5bfdad625ce8ebb6b7d63a065b6033b929`",
    calls: [
      {
        name: "Bash",
        input: {
          command:
            'gh api repos/eval-org/cart/assignees/maintainer -i 2>&1 | head -1; S=$(cd .claude/skills/pr-creator && pwd); python3 -I - <<\'EOF\' > /tmp/prvalues.json\nimport json\nprint(json.dumps({"baseRemote":"origin","targetBranch":"main","headRemote":"origin","currentBranch":"feature/unit-price","baseSha":"2e09fcf965dea6299db570fb025f908cd87e0d75","headSha":"2949cd67160f167ff0ac7c8e24beb2c8d4112c68","title":"refactor: simplify unit price","body":"## Résumé\\n\\n雪 and café\\n","reviewers":[],"labels":[],"assignees":["maintainer"],"state":"draft","effectiveState":"draft"},ensure_ascii=False))\nEOF\npython3 -I "$S/scripts/validate-output.py" digest preview < /tmp/prvalues.json',
        },
        result: {
          content:
            '{"bodyDigest": "ae360e2c95793e21e67dd393108a65069218c0eb86cbad220729bf1476602bc8", "valuesDigest": "247c4746fb5504526a790f328e9aaa5bfdad625ce8ebb6b7d63a065b6033b929"}',
          truncated: false,
          isError: false,
        },
      },
    ],
  },
  {
    name: "pr-creator/created-with-drift repeat 4",
    gate: "preview",
    finalText:
      "Approval token: `a96f59190e31dee5e9f457deb09e1613f67921429dea43d48542761efca2b854`\n- `APPROVED a96f59190e31dee5e9f457deb09e1613f67921429dea43d48542761efca2b854`",
    calls: [
      {
        name: "Bash",
        input: {
          command:
            'gh api repos/eval-org/cart/assignees/maintainer -i 2>&1 | head -3\nD=.handoffs/pr-creator/run1; mkdir -p $D\npython3 -I - <<\'EOF\'\nimport json\nd=".handoffs/pr-creator/run1/"\nbody="## Résumé\\n\\n雪 and café\\n"\nopen(d+"body.txt","w",encoding="utf-8",newline="").write(body)\nv={"baseRemote":"origin","targetBranch":"main","headRemote":"origin","currentBranch":"feature/unit-price","baseSha":"52752cbb4aa99a7d52ee82bf7a2714eaaec60d93","headSha":"e4a744b1872c98b41275c97243de75aad06db316","title":"refactor: simplify unit price","body":body,"reviewers":[],"labels":[],"assignees":["maintainer"],"state":"draft","effectiveState":"draft"}\nopen(d+"preview.json","w",encoding="utf-8").write(json.dumps(v,ensure_ascii=False))\nEOF\npython3 -I /private/var/folders/6w/t9v3njls00xc9s8z_vh_s22c0000gn/T/agent-skills-eval-hVp1pP/repo/.claude/skills/pr-creator/scripts/validate-output.py digest preview < $D/preview.json; xxd $D/body.txt | tail -2',
        },
        result: {
          content:
            '{"bodyDigest": "ae360e2c95793e21e67dd393108a65069218c0eb86cbad220729bf1476602bc8", "valuesDigest": "a96f59190e31dee5e9f457deb09e1613f67921429dea43d48542761efca2b854"}',
          truncated: false,
          isError: false,
        },
      },
    ],
  },
  {
    name: "pr-creator/scope-record-continues repeat 0",
    gate: "scope",
    finalText:
      "Approval token: `660588e50b6bdee84a308ae0f1875e06365f74fe6fa6fafb37b4e60a55376cba`\n- `APPROVED 660588e50b6bdee84a308ae0f1875e06365f74fe6fa6fafb37b4e60a55376cba` to continue to drafting and the exact PR preview, using your title `feat: add fixture values`.",
    calls: [
      {
        name: "Bash",
        input: {
          command:
            'git diff --numstat origin/main...origin/feature/unit-price && S=.claude/skills/pr-creator/scripts/validate-output.py && echo \'{"baseSha":"fa97c68dc79d7dc5d11d02397153cf852eb1571b","headSha":"e3097356e3f33f7480ad78cc4ae478f548aa9b6b","adjustedChangedLines":1001,"changedFiles":1,"excludedTotals":"0 files, 0 lines excluded","areas":["repo root"],"rules":["adjusted changed lines 1001 > 1000"],"changedPaths":["pricing.py"]}\' | python3 -I $S digest scope',
        },
        result: {
          content:
            '{"bodyDigest": "n/a", "valuesDigest": "660588e50b6bdee84a308ae0f1875e06365f74fe6fa6fafb37b4e60a55376cba"}',
          truncated: false,
          isError: false,
        },
      },
    ],
  },
  {
    name: "pr-creator/scope-record-continues repeat 1",
    gate: "scope",
    finalText:
      "Approval token: `79a122eb9d6f7581aed4c947fe90724ccb78ade70b15f6663ce9368c4ed6dfc3`\n- `APPROVED 79a122eb9d6f7581aed4c947fe90724ccb78ade70b15f6663ce9368c4ed6dfc3` to continue to the draft, with title `feat: add fixture values`, draft state, and no reviewers.",
    calls: [
      {
        name: "Bash",
        input: {
          command:
            'printf \'%s\' \'{"baseSha":"b3e9ed573ddd2e514fa33c2033342344a4e293ea","headSha":"da6c27670460d0777f99e1e86ee6371c7faf4dc0","adjustedChangedLines":1001,"changedFiles":1,"excludedTotals":"none","areas":["root: pricing.py (1 file)"],"rules":["adjusted-lines>1000"],"changedPaths":["pricing.py"]}\' | python3 -I .claude/skills/pr-creator/scripts/validate-output.py digest scope',
        },
        result: {
          content:
            '{"bodyDigest": "n/a", "valuesDigest": "79a122eb9d6f7581aed4c947fe90724ccb78ade70b15f6663ce9368c4ed6dfc3"}',
          truncated: false,
          isError: false,
        },
      },
    ],
  },
  {
    name: "pr-creator/scope-record-continues repeat 2",
    gate: "scope",
    finalText:
      "Approval token: `0e63d9f5d2dd76585ea80e0ab46b10da06659fbaff63cf8d5c7847e50cce64c3`\n- `APPROVED 0e63d9f5d2dd76585ea80e0ab46b10da06659fbaff63cf8d5c7847e50cce64c3`",
    calls: [
      {
        name: "Bash",
        input: {
          command:
            'SKILL_DIR="$PWD/.claude/skills/pr-creator" && printf \'%s\' \'{"baseSha":"e81b79b303e8bb6a489e71e62c5bc2983908256f","headSha":"c5c46a2af5ee29c41f8ada03620910e89a2a65f0","adjustedChangedLines":1001,"changedFiles":1,"excludedTotals":"none (0 lines, 0 files)","areas":["pricing.py (repo root)"],"rules":["adjusted changed lines 1001 exceed 1000"],"changedPaths":["pricing.py"]}\' | python3 -I "$SKILL_DIR/scripts/validate-output.py" digest scope',
        },
        result: {
          content:
            '{"bodyDigest": "n/a", "valuesDigest": "0e63d9f5d2dd76585ea80e0ab46b10da06659fbaff63cf8d5c7847e50cce64c3"}',
          truncated: false,
          isError: false,
        },
      },
    ],
  },
  {
    name: "pr-creator/scope-record-continues repeat 3",
    gate: "scope",
    finalText:
      "**Next step:** reply `APPROVED ccaff585fbbbb0e6cf9f056ac77db1160f084f98680c159137c59c35f8fb74ef` to let me go on and draft the PR. That approval covers analysis of this exact evidence only, not creating the PR.",
    calls: [
      {
        name: "Bash",
        input: {
          command:
            'S=/private/var/folders/6w/t9v3njls00xc9s8z_vh_s22c0000gn/T/agent-skills-eval-4yrnw7/repo/.claude/skills/pr-creator; cat > /tmp/scope.json <<\'EOF\'\n{"baseSha":"ef9bd25b1753eea3d692459e4e2160a2504974cb","headSha":"fc3706933e179dc178ce8634d1c4b27799314aa9","adjustedChangedLines":1001,"changedFiles":1,"excludedTotals":"none","areas":["repo root: pricing.py"],"rules":["adjusted-lines>1000"],"changedPaths":["pricing.py"]}\nEOF\npython3 -I "$S/scripts/validate-output.py" digest scope < /tmp/scope.json',
        },
        result: {
          content:
            '{"bodyDigest": "n/a", "valuesDigest": "ccaff585fbbbb0e6cf9f056ac77db1160f084f98680c159137c59c35f8fb74ef"}',
          truncated: false,
          isError: false,
        },
      },
    ],
  },
  {
    name: "pr-creator/scope-record-continues repeat 4",
    gate: "scope",
    finalText:
      "Approval token: `85a23db5515f5041223d32adb5cec456ad8a51405b903a5d4024db56b47b4fa5`\n- `APPROVED 85a23db5515f5041223d32adb5cec456ad8a51405b903a5d4024db56b47b4fa5`",
    calls: [
      {
        name: "Bash",
        input: {
          command:
            'D=.handoffs/pr-creator/run1 && mkdir -p $D && cat > $D/scope.json <<\'EOF\'\n{"baseSha":"4ec0795d2e0cfe157ef1373a4ce21b0d763af023","headSha":"c655eb26375297762f66fc06e870efd26857cda2","adjustedChangedLines":1001,"changedFiles":1,"excludedTotals":"none excluded (0 lines, 0 files)","areas":["pricing.py (repo root)"],"rules":["adjusted changed lines 1001 > 1000"],"changedPaths":["pricing.py"]}\nEOF\npython3 -I /private/var/folders/6w/t9v3njls00xc9s8z_vh_s22c0000gn/T/agent-skills-eval-NdhMrP/repo/.claude/skills/pr-creator/scripts/validate-output.py digest scope < $D/scope.json',
        },
        result: {
          content:
            '{"bodyDigest": "n/a", "valuesDigest": "85a23db5515f5041223d32adb5cec456ad8a51405b903a5d4024db56b47b4fa5"}',
          truncated: false,
          isError: false,
        },
      },
    ],
  },
] as const;
const FINALS = [
  {
    name: "pr-creator/approved-exact-bytes-assignee repeat 0",
    finalText:
      "I opened the draft PR, and the platform's returned fields all match the approved preview: https://github.com/eval-org/cart/pull/17\n\n- **Mode and platform:** inline mode, with GitHub as the platform.\n- **Base:** `origin/main` at `2223095e3e678e014b7903d4876d3f9ab19d1395`.\n- **Head:** `origin/feature/unit-price` at `0d2bc053d92bd4c281f0d8862f0efe4dda041d03`.\n- **Title:** `refactor: simplify unit price`",
  },
  {
    name: "pr-creator/approved-exact-bytes-assignee repeat 1",
    finalText:
      "I created the draft PR and checked it against the approved preview: https://github.com/eval-org/cart/pull/17\n\nAll the fields I read back from GitHub match what you approved. The PR body I got back is byte-identical to the approved one: both hash to `ae360e2c…2bc8`, including the final newline and the `é` and `雪` characters.\n\n| Field | Returned by GitHub |\n| --- | --- |",
  },
  {
    name: "pr-creator/approved-exact-bytes-assignee repeat 2",
    finalText:
      "I opened the draft PR, and every field I read back matches the approved preview: https://github.com/eval-org/cart/pull/17\n\nI ran each step inline rather than dispatching subagents.\n\n| Field | Returned by GitHub |\n|---|---|",
  },
  {
    name: "pr-creator/approved-exact-bytes-assignee repeat 3",
    finalText:
      "The draft PR is open and checked: https://github.com/eval-org/cart/pull/17\n\nI read it back from GitHub and every field matches the approved preview.\n\n- **Mode:** I ran the specialist steps inline, not as dispatched subagents.\n- **Base:** `main` at `1536571b110e51d53a5347392c58d3aeadd70dc2`",
  },
  {
    name: "pr-creator/approved-exact-bytes-assignee repeat 4",
    finalText:
      "The draft PR is open, and the platform's returned fields all match the approved preview: https://github.com/eval-org/cart/pull/17\n\n| Field | Returned by GitHub |\n|---|---|\n| Title | `refactor: simplify unit price` |\n| State | Draft, open |",
  },
] as const;
const TITLES = [
  {
    name: "pr-creator/template-title-observed-retained repeat 0",
    title: "Title:        feat: TASK-42 Simplify Unit Price",
    token: "52f77b2ca64d95bd20ce2fda038819d20f55ecbbe5085667a4f5abae52ba8471",
  },
  {
    name: "pr-creator/template-title-observed-retained repeat 1",
    title: "Title:        feat: TASK-42 Simplify Unit Price",
    token: "780788373fff7c1c199d2d0813e66e601d9c1e1277527376e8eb5ea74b0711e4",
  },
] as const;

describe("pr-creator second-run machine regressions", () => {
  it.each(GATES)(
    "approves only the captured displayed $gate digest: $name",
    ({ gate, finalText, calls }) => {
      const toolCalls: ToolCall[] = [...calls];
      const observation = {
        ...preparedObservation(finalText, gate),
        toolCalls,
      };
      const approvalGate = gate === "scope" ? approveScope : approvePreview;
      expect(approvalGate(observation)).toHaveProperty("reply");
      expect(approvalGate({ ...observation, toolCalls: [] })).toHaveProperty(
        "gateNotReached",
      );
      expect(
        approvalGate({ ...observation, finalText: "No token shown" }),
      ).toHaveProperty("gateNotReached");
    },
  );
  it.each(FINALS)(
    "does not regex-grade semantic completion text: $name",
    ({ finalText }) => {
      expect(() =>
        checkCreated({ ...createdObservation(), finalText }, false),
      ).not.toThrow();
    },
  );
  it.each(TITLES)(
    "preserves title structure, with grounding delegated to judge: $name",
    ({ title, token }) => {
      expect(() =>
        checkTemplate({
          ...preparedObservation(`${title}\n${token}`),
          toolCalls: [digestCall("preview", token)],
        }),
      ).not.toThrow();
    },
  );
  it("keeps unknown-verification repeat 2 failing because it never ran the digest helper", () => {
    expect(() =>
      checkUnknownVerification({
        ...preparedObservation(
          "Reply APPROVED to create this draft PR exactly as shown.",
        ),
        toolCalls: [],
      }),
    ).toThrow(/digest/);
  });
});
