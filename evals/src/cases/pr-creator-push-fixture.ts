import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// Receive-pack never sees client-side rejections (including stale leases).
// Its hook records accepted updates; the client records porcelain rejection rows.
const LOG_UPDATE = String.raw`
import json, os, subprocess, sys
from pathlib import Path
remote = Path(__REMOTE__)
real_git = __GIT__
def git(*args, cwd=None):
    return subprocess.check_output([real_git, *args], cwd=cwd, text=True).strip()
def capture(old, new, ref, accepted, url):
    zero = '0' * 40
    fast = old == zero or (new != zero and subprocess.run([real_git, 'merge-base', '--is-ancestor', old, new]).returncode == 0)
    number = len(list(remote.parent.glob('eval-push-*.json'))) + 1
    path = remote.parent / f'eval-push-{number}.json'
    with path.open('x') as stream:
        json.dump(dict(url=url, old=old, new=new, ref=ref, fastForward=fast, accepted=accepted, args=json.loads(os.environ.get('FIXTURE_PUSH_ARGS','null'))), stream)
    if accepted and os.environ.get('FIXTURE_CAPTURE_LIST'):
        with open(os.environ['FIXTURE_CAPTURE_LIST'], 'a') as captures: print(path, file=captures)
`;
const CLIENT = String.raw`
args = sys.argv[1:]
index = 0
while args[index:index+1] in (['-C'], ['-c']): index += 2
if args[index:index+1] != ['push']:
    os.execv(real_git, [real_git, *args])
command = [real_git, *args[:index+1], '--porcelain', *args[index+1:]]
os.environ['FIXTURE_PUSH_ARGS'] = json.dumps(args)
# The receiver knows old/new; only the client knows which URL Git actually used.
from tempfile import NamedTemporaryFile
with NamedTemporaryFile(mode='r') as captures:
    os.environ['FIXTURE_CAPTURE_LIST'] = captures.name
    result = subprocess.run(command, stdout=subprocess.PIPE, text=True)
    accepted = {}
    for entry in captures:
        path = Path(entry.rstrip('\n'))
        record = json.loads(path.read_text())
        accepted.setdefault(record['ref'], []).append((path, record))
sys.stdout.write(result.stdout)
for line in result.stdout.splitlines():
    if line.startswith('To '): url = line[3:]
    if line.startswith('!\t'):
        src, ref = line.split('\t')[1].split(':', 1)
        old = git('--git-dir', str(remote), 'rev-parse', ref)
        new = git(*args[:index], 'rev-parse', src) if src else '0' * 40
        capture(old, new, ref, False, url)
    elif line[1:2] == '\t' and line[0] != '=':
        ref = line.split('\t')[1].split(':', 1)[1]
        if accepted.get(ref):
            path, record = accepted[ref].pop(0)
            # Git porcelain strips SSH usernames. The receiver retains the verified URL.
            source_url = record['url']
            if url != source_url.removeprefix('git@'): source_url = url
            path.write_text(json.dumps({**record, 'url':source_url}))
sys.exit(result.returncode)
`;
export function configurePush(
  repoPath: string,
  binPath: string,
  remote: string,
): void {
  const realGit = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
  const common = `#!/usr/bin/env python3\n${LOG_UPDATE.replace("__REMOTE__", JSON.stringify(remote)).replace("__GIT__", JSON.stringify(realGit))}`;
  writeFileSync(join(binPath, "git"), common + CLIENT, { mode: 0o755 });
  writeFileSync(
    join(remote, "hooks/post-receive"),
    `${
      common
    }\nfor line in sys.stdin:\n    old, new, ref = line.split()\n    capture(old, new, ref, True, os.environ.get('FIXTURE_PUSH_URL', str(remote)))\n`,
    { mode: 0o755 },
  );
  const ssh = join(repoPath, ".git/fixture-ssh");
  writeFileSync(
    ssh,
    `#!/bin/sh\nfor command do :; done\ncase "$command" in\n "git-upload-pack 'eval-org/cart.git'") exec git-upload-pack "$1" ;;\n "git-receive-pack 'eval-org/cart.git'") FIXTURE_PUSH_URL='git@github.com:eval-org/cart.git' exec git-receive-pack "$1" ;;\n *) exit 79 ;;\nesac\n`,
    { mode: 0o755 },
  );
  execFileSync(
    "git",
    [
      "config",
      "core.sshCommand",
      `${JSON.stringify(ssh)} ${JSON.stringify(remote)}`,
    ],
    { cwd: repoPath },
  );
}
