# Issue references

Load only when an explicit list names an issue. Use this reference at `GateIssueRefs` and when rendering or verifying the resulting issue references.

## `GateIssueRefs`

For an invalid explicit list, show the rejected entries with their reasons: `These references could not be used: <entries and reasons>. Give replacements, drop the entries, or stop?` Do not re-ask about valid explicit references.

Once classifications are settled, show each applicable closure condition and ask one question about the current closing list.

```text
The target is <target branch>, not the default branch <default branch>. Closing references: <refs>.
Keep the closing keywords with no automatic close, or move these issues to Related?
```

```text
<platform> cannot verify which issues the closing keywords will close: <refs>.
Keep the closing keywords as unverifiable, or move these issues to Related?
```

If both apply, give both reasons and offer the second choice once. Keeping the keywords records `Auto-close: unverifiable`; the non-default branch still means automatic closure is not expected. Moving the issues to related removes their closing keywords. A classification or keyword choice is not approval to submit.

## Preview and body

Show `Closes: <refs> (<expectation>)` and `Related: <refs>`, using `none` for an empty list. The closing expectations are `automatic close expected on merge` for `yes`, `no automatic close` for `no`, and `not verifiable on <platform>` for `unverifiable`. If both closure conditions applied, also show `no automatic close` for the non-default target. No expectation is needed when `Closes: none`.

End the body with `## Issues` when there are approved references. Use one line per issue: `- Closes <ref> — <change that delivers it>` or `- Related: <ref> — <why>`. Same-repository refs can be `#n` in the body; keep cross-repository refs in full `path#n` form everywhere. Write no closing keyword anywhere else in the body. Omit the section if both lists are empty.

```markdown
## Issues
- Closes #12 — Reuses the existing session after a retry.
- Related: example/library#7 — Documents the retry limit.
```

Both lists belong in the approved values. If a body override's closing keywords disagree with the approved list, the preview digest fails; go to `FinalDecision` without showing a proposal. Report missing or extra recognized closures issue by issue on readback. If `closes` is unsupported, the final report says it was not compared and does not claim closure was verified.

## Read-only platform lookups

Set `host` to `PLATFORM_HOST`, the credential-free host of the selected base remote. Use `BASE_REPOSITORY` from preflight as the base repository path. Check that each lookup uses the pinned host, that paths contain only valid repository components, and that `issue_number` is a positive decimal integer. For a URL, require an HTTPS issue permalink on that host: `/<owner>/<repo>/issues/<n>` on GitHub or `/<namespace>/<project>/-/issues/<n>` on GitLab. Reject embedded credentials, PR/MR paths, external tracker URLs, and path traversal. Build the API path from validated components. Do not send credentials to a host from a reference.

Use `PLATFORM_PLAYBOOK` for repository and issue lookup commands and response mappings. For a cross-repository reference, use the validated reference repository in place of the base repository in the lookup, on the same pinned host. Reject a PR/MR returned as an issue. Use the returned issue permalink to confirm identity, never as a new request target. Keep only the needed fields.

Check the base repository once and reuse project/repository metadata when checking reference repositories. Use the platform-returned path for canonical refs. Do not silently substitute an issue moved to a different repository or number. A reported authentication or permission failure is `AUTH`; a rate limit, network failure or ambiguous response is `ERROR`. Treat a not-found response as missing only when the repository and its issue tracker are known to be accessible and there is no evidence the response conceals an access failure. A known unavailable native tracker means the user must drop any explicit references to it or stop. For an unlisted lookup path or unverified syntax, follow the [unknown syntax policy](./platform-adaptation.md#unknown-syntax-policy).
