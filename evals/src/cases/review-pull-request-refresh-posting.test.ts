import { describe, expect, it } from "vitest";

import { GITHUB_FACTS } from "#/cases/pr-creator-fixtures.ts";
import {
  exercise,
  SUCCESS,
  TIMEOUT_MS,
} from "#/cases/review-pull-request-refresh-test-support.ts";

// A late thread on the same commit changes both the author obligations and the posting basis.
const THREAD_CHANGE = String.raw`
snapshot()  # Expand the fake's seeded threads before selecting the late arrival.
state = json.loads(state_file.read_bytes())
threads = state['graphql']['data']['repository']['pullRequest']['reviewThreads']
later = threads['nodes'].pop(0)
threads['totalCount'] = len(threads['nodes'])
state_file.write_text(json.dumps(state))
old = snapshot()
def collected(history):
    return [dict(thread_id=t['thread_id'], is_resolved=t['is_resolved'], viewer_can_unresolve=t['viewer_can_unresolve'],
                 root_comment_id=int(t['root_comment_id']), root_url=t['root_url'], path=t['path'], line=t['line'],
                 summary='Collected review comment') for t in history['evidence']['threads']]
def assessments(threads):
    return [dict(root_comment_id=t['root_comment_id'], status='still-valid', evidence='Checked at pinned head')
            for t in threads if not t['is_resolved']]
context.update(posting_basis=old['posting_basis'], threads=collected(old))
author.update(thread_assessments=assessments(context['threads']))
save_draft()
threads['nodes'].insert(0, later)
threads['totalCount'] = len(threads['nodes'])
state_file.write_text(json.dumps(state))
current = snapshot()
assert old['posting_basis'] != current['posting_basis']
fresh = dict(context, threads=collected(current), posting_basis=current['posting_basis'])
old_roots = {a['root_comment_id'] for a in author['thread_assessments']}
new_roots = {a['root_comment_id'] for a in assessments(fresh['threads'])}
assert new_roots - old_roots == {701} and old_roots <= new_roots
put(candidate, 'context', fresh)
original = saved.read_bytes()
evidence = json.loads(post(*resume).stdout)
assert evidence['history'] == 'changed'
`;

const REAUTHOR_AND_PREVIEW = String.raw`
replace = [run, saved, '--replace', evidence['output_sha256']]
rejected = cli('render-review.py', *replace, code=1)
assert 'thread_assessments must cover exactly' in rejected.stderr and saved.read_bytes() == original, rejected
summary = 'The empty cart regression persists at the pinned head.'
author.update(summary=summary, thread_assessments=assessments(fresh['threads']))
put(run/'author.txt', 'author', author)
put(run/'verify.txt', 'verify', dict(issues=[], observed_checks=['Checked all unresolved roots at the reviewed head']))
for mode in ['author', 'verify']:
    cli('validate-output.py', mode, stdin=(run/(mode+'.txt')).read_text())
cli('render-review.py', *replace)
assert summary in saved.read_text() and '#discussion_r701' in saved.read_text()
preview = post('--dry-run', run).stdout
assert summary in preview and not posts.read_bytes()
approval = re.search(r'^approval-sha256: ([0-9a-f]{64})$', preview, re.M)[1]
`;

describe("posting with refreshed review history", () => {
  it.each([
    ["omitted new unresolved root", "fresh['threads'].remove(late_root)"],
    [
      "permission absent from the live snapshot",
      "assert not late_root['viewer_can_unresolve']; late_root['viewer_can_unresolve'] = True",
    ],
    [
      "incorrect resolution for the new root",
      "late_root['is_resolved'] = True",
    ],
  ])(
    "rejects %s even with the fresh posting basis",
    (_label, change) => {
      expect(
        exercise(
          THREAD_CHANGE +
            String.raw`
late_root = next(t for t in fresh['threads'] if t['root_comment_id'] == 701)
assert not late_root['is_resolved']
${change}
put(candidate, 'context', fresh)
before, offset = tree(), api_log.stat().st_size
refusal = post(*resume, '--refresh', code=3)
assert (refusal.stdout, refusal.stderr) == ('', 'refresh-mismatch\n'), refusal
assert tree() == before
no_writes_since(offset)
`,
          true,
        ),
      ).toMatchObject(SUCCESS);
    },
    TIMEOUT_MS,
  );

  it(
    "requires re-authoring for a new unresolved root, then posts the verified and previewed review",
    () => {
      expect(
        exercise(
          THREAD_CHANGE +
            String.raw`
evidence = json.loads(post(*resume, '--refresh').stdout)
` +
            REAUTHOR_AND_PREVIEW +
            String.raw`
receipt = json.loads(post('--approved', approval, run).stdout)
assert receipt['complete'] and not receipt['failed'], receipt
[review] = [json.loads(line) for line in posts.read_text().splitlines()]
assert review['endpoint'] == 'repos/${GITHUB_FACTS.repository}/pulls/17/reviews'
assert review['payload']['body'] == summary and review['payload']['commit_id'] == context['head_sha']
`,
          true,
        ),
      ).toMatchObject(SUCCESS);
    },
    TIMEOUT_MS,
  );

  it(
    "blocks the same verified and previewed package if it still carries the old posting basis",
    () => {
      expect(
        exercise(
          THREAD_CHANGE +
            String.raw`
put(installed, 'context', dict(fresh, posting_basis=old['posting_basis']))
` +
            REAUTHOR_AND_PREVIEW +
            String.raw`
refusal = post('--approved', approval, run, code=3)
assert 'history changed' in refusal.stderr and not posts.read_bytes(), refusal
assert not (run/'receipts.json').exists()
`,
          true,
        ),
      ).toMatchObject(SUCCESS);
    },
    TIMEOUT_MS,
  );
});
