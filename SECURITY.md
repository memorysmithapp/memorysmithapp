# Security policy

## How to report

**Never open a public issue for a security failure.** This repository is public, and an
issue describing how to reach the data of another account is an exploitation instruction in
plain sight for as long as the fix is not out.

Use the private GitHub channel:

> **Security → Advisories → Report a vulnerability**
> [github.com/memorysmithapp/memorysmithapp/security/advisories/new](https://github.com/memorysmithapp/memorysmithapp/security/advisories/new)

Only the maintainers of the repository see the report, and the conversation happens there
until there is a published fix.

The channel holds for both modes of operation. A report about a **self-hosted install**
states the installed version and says that it is a self-hosted install, because the hosted
instance is observable by whoever maintains the project and a third-party one is not.

## What to report through here

Anything that breaks one of the guarantees below is a security failure, even if it looks
small and even if you are not sure:

| What you observed | Why it is serious |
|---|---|
| Content, a vault name, a note or a member of **another subscription** | Isolation by subscription is the central guarantee of the product: every data key starts with the subscription, and no request may choose which one |
| A resource that is not yours answering **`403`** instead of `404` | The `403` confirms that the thing exists, and that confirmation is already a leak |
| A platform administrator session reaching **customer content** | A platform token carries no subscription, so there should be no key it can assemble |
| A record of the **audit trail** altered or deleted | The trail is append-only by IAM policy, not by discipline |
| An **MCP connector token** accepted outside the subscription that consented to it | Consent fixes the subscription, and the token should not work in another |
| Note bytes **destroyed** by any operation | Deleting is always reversible, and nothing in the product destroys a revision: there is no port, route or administrative act that does it |
| Any credential, key or secret exposed in the repository or in an API response | |

It is worth reporting even if you ran into it by accident and cannot reproduce it. An
imprecise report of a leak is worth more than a polite silence.

## What is **not** a case for this channel

Friction in use, a missing feature, a defect that leaks no data and breaks no authorisation,
and questions about installing follow the normal path:
[open a feedback issue](https://github.com/memorysmithapp/memorysmithapp/issues/new?template=01-feedback.yml).

## Vault content in reports

When reporting, **do not paste real content from your notes**, customer names or business
data, neither here nor in a public issue. Describe the shape of the problem with invented
examples, and send identifiers (`vaultId`, `noteId`) instead of text. If the fix depends on
seeing the content, we will ask for it through an agreed path.

## Response

This is a small project, and promising a deadline that is not met is worse than not
promising. The commitment is: **acknowledge receipt within 72 hours** and keep you informed
in the advisory itself until there is a fix or a recorded decision not to fix, with the
reason.

## Versions covered

The product is on `0.x` and is deployed as a single version across the three projects. Only
the most recently published version receives a fix; there is no backport to earlier
versions while `1.0.0` does not exist.

That holds for both modes of operation (`software-vision.md` §4.9). **Whoever runs their own
instance receives the fix through the repository and is responsible for applying it:** there
is no automatic update and no notice directed at whoever installed it.
