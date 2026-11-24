import { expect, it } from "vitest";

import { approvePreview } from "#/cases/pr-creator-behavior-checks.ts";
import { preparedObservation } from "#/cases/pr-creator-test-support.ts";

function gate(command: string) {
  const prepared = preparedObservation();
  return approvePreview({
    ...prepared,
    toolCalls: [{ name: "Bash", input: { command } }, ...prepared.toolCalls],
  });
}
it.each([
  "gh pr create --help | grep -- --draft; gh issue view 42",
  "gh api --method GET repos/eval-org/cart --jq .DELETE",
  "printf '%s' 'git push main' > .handoffs/pr-creator/run/body.md",
  'RUN_DIR=.handoffs/pr-creator/sample && cat > $RUN_DIR/push-values.json <<\'J\'\n{"action":"git push origin main"}\nJ',
  'python3 -I "$SKILL_DIR/scripts/validate-output.py" digest push <<\'JSON\'\n{"action":"git push main"}\nJSON',
  "echo 'Push command: git push origin head'",
  "gh api pulls -X GET -f state=open",
  "git push --help",
])("allows a read or confined proposal: %s", (command) => {
  expect(gate(command)).toEqual({ reply: "approved" });
});
it.each([
  "gh pr create --help; gh issue close 42",
  "gh api repos/eval-org/cart --method=PATCH",
  "gh api -XPOST repos/eval-org/cart",
  "gh pr create --title=--help",
  "gh pr create --help=false",
  "bash -c 'gh issue close 42'",
  'printf "%s" "$(gh issue close 42)"',
  "echo 'git push main' | sh",
  "git push origin main",
  "gh api repos/eval-org/cart/pulls -f state=open",
  "git push --help; git push origin main",
  "echo ok > outside.txt",
  "cat > /tmp/out <<'J'\n{}\nJ",
  "cat > .handoffs/pr-creator/run/script <<'J'\ngit push origin main\nJ\nsh .handoffs/pr-creator/run/script",
])("rejects a mutation: %s", (command) => {
  expect(() => gate(command)).toThrow();
});
