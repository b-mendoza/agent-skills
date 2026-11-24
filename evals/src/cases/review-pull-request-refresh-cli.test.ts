import { describe, expect, it } from "vitest";

import { FEEDBACK_URL } from "#/cases/review-pull-request-fixtures.ts";
import {
  exercise,
  SUCCESS,
  TIMEOUT_MS,
} from "#/cases/review-pull-request-refresh-test-support.ts";

const USAGE_ERROR = 2;
const CHANGED_HISTORY = String.raw`
context.update(shortstat='1 file changed', linked_context='Receipt rounding contract', test_signals='Tests not run',
               limitations=['No integration environment'], references=['https://example.org/rounding'],
               risk_areas=['Fractional totals'])
save_draft()
state['pr']['reviews'] = [dict(state='COMMENTED', body='Review the rounding mode', html_url='${FEEDBACK_URL.review}',
                             commit_id=context['head_sha'], user=dict(login='auditor'))]
state['pr']['comments'] = [dict(body='New discussion at the same pins', html_url='${FEEDBACK_URL.discussion}',
                              user=dict(login='maintainer'))]
state_file.write_text(json.dumps(state))
feedback = [dict(kind='review-summary', url='${FEEDBACK_URL.review}', summary='Check how fractional totals round.'),
            dict(kind='discussion', url='${FEEDBACK_URL.discussion}', summary='Maintainer added a discussion note.')]
fresh = dict(context, ci='Passed at refresh time', posting_basis=snapshot()['posting_basis'], feedback=feedback)
assert fresh['posting_basis'] != context['posting_basis']
put(candidate, 'context', fresh)
`;

const MISMATCH = "refresh-mismatch";
const REFUSALS = [
  [
    "omitted new discussion URL",
    "fresh['feedback'] = [f for f in feedback if f['kind'] != 'discussion']",
    MISMATCH,
  ],
  [
    "review URL recorded as discussion",
    "feedback[0]['kind'] = 'discussion'",
    MISMATCH,
  ],
  ["changed PR author", "fresh['author'] = 'another-author'", MISMATCH],
  ["changed title", "fresh['title'] = 'A different review'", MISMATCH],
  ["lost diff summary", "fresh['shortstat'] = ''", MISMATCH],
  ["lost linked context", "fresh['linked_context'] = ''", MISMATCH],
  ["lost test signals", "fresh['test_signals'] = ''", MISMATCH],
  ["changed behavior", "fresh['behavior_summary'] = 'New behavior'", MISMATCH],
  ["lost risk areas", "fresh['risk_areas'] = []", MISMATCH],
  ["lost references", "fresh['references'] = []", MISMATCH],
  ["lost limitations", "fresh['limitations'] = []", MISMATCH],
  [
    "occupied guarded writer staging file",
    "(run/'render.tmp').write_bytes(b'keep this file')",
    MISMATCH,
  ],
  [
    "stale posting basis",
    "fresh['posting_basis'] = context['posting_basis']",
    MISMATCH,
  ],
  ["missing candidate", "candidate.unlink()", "refresh-missing"],
  ["invalid context payload", "fresh.pop('title')", MISMATCH],
  ["changed head SHA", "fresh['head_sha'] = 'c'*40", MISMATCH],
  ["changed merge-base SHA", "fresh['base_sha'] = 'c'*40", MISMATCH],
  ["changed base branch", "fresh['base'] = 'release'", MISMATCH],
  ["another PR", "fresh['pr'] = fresh['pr'].replace('/17', '/18')", MISMATCH],
  ["changed head branch", "fresh['head'] += '-renamed'", MISMATCH],
  ["changed files", "fresh['changed_files'] += ['new.py']", MISMATCH],
  [
    "changed dimensions",
    "fresh['dimensions'][0]['rationale'] = 'Different review scope'",
    MISMATCH,
  ],
  ["closed candidate", "fresh['state'] = 'closed'", MISMATCH],
  ["incomplete candidate history", "fresh['history'] = 'partial'", MISMATCH],
  [
    "missing candidate posting basis",
    "fresh['posting_basis'] = None",
    MISMATCH,
  ],
  [
    "hand-edited saved draft",
    "saved.write_bytes(saved.read_bytes() + b'hand edit\\n')",
    "draft-differs",
  ],
  [
    "existing posting receipt",
    "(run/'receipts.json').write_text('{\"complete\":false}')",
    "already-posted",
  ],
  [
    "live head drift",
    "state['head'] = state['base']; state_file.write_text(json.dumps(state))",
    "drift:head",
  ],
] as const;

describe("refreshing a saved review", () => {
  it(
    "installs only the candidate context and returns the original resume evidence",
    () => {
      expect(
        exercise(
          CHANGED_HISTORY +
            String.raw`
ordinary = json.loads(post(*resume).stdout)
assert ordinary['history'] == 'changed' and ordinary['refreshed'] is True
assert ordinary['output_sha256'] == hashlib.sha256(saved.read_bytes()).hexdigest()
before, offset = tree(), api_log.stat().st_size
reply = json.loads(post(*resume, '--refresh').stdout)
assert reply == ordinary, reply
assert tree() == {**before, installed: candidate.read_bytes()} and before[installed] != installed.read_bytes()
no_writes_since(offset)
`,
        ),
      ).toMatchObject(SUCCESS);
    },
    TIMEOUT_MS,
  );

  it.each(REFUSALS)(
    "rejects %s without changing any directory bytes",
    (_label, change, reason) => {
      expect(
        exercise(
          CHANGED_HISTORY +
            String.raw`
${change}
if candidate.exists(): put(candidate, 'context', fresh)
before, offset = tree(), api_log.stat().st_size
rejected = post(*resume, '--refresh', code=3)
assert (rejected.stdout, rejected.stderr) == ('', '${reason}\n'), rejected
assert tree() == before, 'refusal changed the workspace'
no_writes_since(offset)
`,
        ),
      ).toMatchObject(SUCCESS);
    },
    TIMEOUT_MS,
  );

  it(
    "preserves a concurrent context edit when the writer checks the original digest",
    () => {
      expect(
        exercise(
          CHANGED_HISTORY +
            String.raw`
import runpy
poster = runpy.run_path(str(scripts/'post-review.py'))
before, offset = tree(), api_log.stat().st_size
edited = before[installed] + b'\n'
def edit_during_preflight(args):
    if args[-1] == 'user': installed.write_bytes(edited)
    return poster['gh'](args)
assert poster['execute'](['--resume', str(saved), '--refresh'], edit_during_preflight) == 3
assert tree() == {**before, installed: edited}
no_writes_since(offset)
`,
        ),
      ).toMatchObject({ status: 0, stdout: "", stderr: "refresh-mismatch\n" });
    },
    TIMEOUT_MS,
  );

  it.each([
    ["help", "['-h']", SUCCESS.status],
    ["missing saved review", "['--resume', '--refresh']", USAGE_ERROR],
    ["refresh without resume", "['--refresh', saved]", USAGE_ERROR],
    ["repeated refresh", "[*resume, '--refresh', '--refresh']", USAGE_ERROR],
    [
      "refresh mixed with preview",
      "[*resume, '--refresh', '--dry-run']",
      USAGE_ERROR,
    ],
  ] as const)(
    "shows refresh syntax for %s without effects",
    (_label, args, code) => {
      expect(
        exercise(String.raw`
before, log = tree(), api_log.read_bytes()
result = post(*${args}, code=${code})
usage = result.stdout if result.returncode == 0 else result.stderr
assert '--resume SAVED_REVIEW' in usage and '--refresh' in usage, usage
assert tree() == before and api_log.read_bytes() == log
`),
      ).toMatchObject(SUCCESS);
    },
    TIMEOUT_MS,
  );
});
