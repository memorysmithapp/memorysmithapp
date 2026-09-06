<!--
Both sections below are mandatory. The process is in CONTRIBUTING.md § 5.
Delete this comment before submitting.
-->

## Summary of changes

<!--
What the profile says now that it did not say before, and what an implementation has to
change to keep conforming. Reference the issue that originated it with `Closes #N`.
-->

## What an implementation has to do

<!--
Written for whoever maintains an implementation, not for whoever reviews this diff.
"Nothing, this is prose" is a complete answer and the most common one.
-->

## The three files

<!--
A notation lives in SPEC.md, profile.json and tests/conformance.json at once. Tick what
this pull request touched, and if the three are not in step, say why on the line below.
-->

- [ ] `SPEC.md`, because the prose of a notation changed
- [ ] `profile.json`, because an entry was added, changed or removed
- [ ] `tests/conformance.json`, because a case was added or its expectation changed
- [ ] `CHANGELOG.md`, in the same commit as the change it documents
- [ ] None of the above: this pull request changes no notation

`npm run check` passes locally: <!-- yes / no, and why not -->

## Version

<!-- The bump this cuts, per CONTRIBUTING.md § 6, or "none, it alters no notation". -->

## AI productivity analysis

| Metric | Value |
|---|---|
| Lines of code handled (added + removed) | {loc_added + loc_removed} ({loc_added} added, {loc_removed} removed) |
| Branch duration | {duration} (from `{branch_start_date}` to `{pr_date}`) |
| Technologies involved | {comma-separated list} |

### Estimated human effort (without AI assistance)

> **Estimated effort:** {hours}h, roughly {total_days} working days (8h/day) or {total_weeks} working weeks (40h/week).

<!--
How to fill it in:

- Lines handled: `git diff --stat origin/main...HEAD`, insertions plus deletions of the
  totals line.
- Branch duration: the date of the first commit on the branch, to today.
- Technologies involved: what the diff actually touched — Markdown, JSON Schema,
  JavaScript, GitHub Actions. Do not list what exists in the repository and was not touched.
- Estimated effort: how long one person would take to reach the same result alone, without
  AI assistance. On a specification the volume is a poor guide and the weight is elsewhere:
  reading the base specifications for the answer, checking what other implementations do
  with the same characters, and writing the cases that prove it. Use `< 1h` when it is
  smaller than an hour, and count it as 0.5h in the arithmetic.
- {total_days} = {hours} ÷ 8, one decimal place. {total_weeks} = {hours} ÷ 40, one decimal.
-->
