# Documentation targets

For a `DOC` target, preserve facts and links under [the protected boundary](./protected-surfaces.md). Use the same roles and plan card as for code.

- Merge duplicate statements into the document that owns the fact and link to it. You may reorder sections, split or move documents, tighten wording, and update references to code moved or renamed by approved steps.
- Code is the authority for facts about code. Put any pre-existing contradiction on the card as a deferred finding; leave the statement unchanged. Correcting it is a separate task.
- Order each documentation step after the code steps it describes.
- Classify discovered link or anchor checkers under [validation safety](./validation-safety.md). Select at most one exact user-supplied or discovered command. Prefer one that covers both code and docs; if only separate candidates exist, select one on the card, name the unselected candidate and the uncovered part as a warning, and let the user adjust the card or supply one command that runs both. Do not combine commands yourself.
- Without a selected checker, put documentation on the warning path even if code tests pass. The reviewer checks statement mapping and link resolution by reading; the best outcome is `PASS_WITH_WARNINGS`.
