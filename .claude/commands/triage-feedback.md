# Feedback triage

Runs stage 2 of the cycle defined in `docs/development-process.md` §4. Read that section
before starting, because it is the source of truth and this command is only the script.

## What to do

**1. Collect.** List the open issues labelled `feedback` and read each one in full, comments
included:

```
gh issue list --label feedback --state open --json number,title,body,createdAt,labels
```

If there are none, say so and stop. Do not invent work.

**2. Group by friction, never by request.** Two issues asking for different things may come
from the same friction, and it is the friction that gets solved. A request for a
"duplicate note button" and another for "import from a file" may be the same person saying
that creating the tenth similar note costs too much.

When grouping, prefer the **"how did you work around it"** field over the "what would you
do" one: whoever worked around it measured the pain, and the workaround says its size.

**3. For each group, answer first the question that separates the cheap outcomes from the
expensive ones:**

> Does this get solved by **writing**, or only by **building**?

A good part of what arrives as missing functionality is a missing `README`. Before proposing
to build, check whether the subject is already documented: read the `README.md` and look in
`docs/software-vision.md` for the rule governing the behaviour being complained about. If
the product already does what the person wanted and they did not find how, the outcome is
`type:documentation`.

**4. Classify each group into one of the four outcomes** of `development-process.md` §4.2:
`type:documentation`, `type:defect`, `type:gap` (or `type:friction`), or a refusal.

A group is `type:defect` when the observed behaviour **diverges from what
`software-vision.md` already states**. Confirm that by citing the contradicted `RN-XXX`; if
no existing rule covers the case, it is not a defect, it is a gap.

**5. Assign the bounded context** (`ctx:SUB`, `ctx:ACC`, `ctx:KNW`, `ctx:DSC`, `ctx:AUD`,
`ctx:AGT`, `ctx:PRT`, `ctx:UI`, `ctx:Infra`). If a group crosses two contexts, that usually
means it is two groups: split it.

## What to deliver

One proposal per group, in a table, with these columns: the friction distilled into one
sentence, the issues it came from, the proposed outcome, the context, and the `RN-XXX` that
would have to be created or changed (or "none").

After the table, for each group you propose to **refuse**, write the draft of the refusal
comment, addressed to whoever reported it and saying the reason. Refusal is a first-class
outcome: an issue that closes with no written reason reopens the same discussion in six
months.

## What not to do

- **Do not create, edit, close or label any issue.** This command produces a proposal for
  human review. Applying the triage is always a decision of the user.
- **Do not open a branch and do not write code.** Implementation is stage 4, and it starts
  after a scope is closed in a `proposal` issue.
- **Do not treat each issue as a unit of work.** If the outcome is one roadmap issue per
  feedback issue, the distillation did not happen.
- **Do not invent demand from a single voice.** Say when a group has a single origin: with
  few users, every voice carries disproportionate weight, and the number of people who felt
  the same friction is prioritisation information, not a detail.
