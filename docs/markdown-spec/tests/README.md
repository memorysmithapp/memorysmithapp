# The conformance suite

The executable half. A specification is a claim; this is the part that can be checked.

## The format

`conformance.json` holds an array of cases. Each case is one Markdown input and what a conforming implementation derives from it.

```json
{
  "id": "wikilink/anchor-is-kept-and-not-resolved",
  "notation": "wikilink-anchor",
  "markdown": "See [[Lei 14.133#Article 75]] for the exception.",
  "links": [{ "slug": "lei-14133", "anchor": "article-75" }]
}
```

| Field | Meaning |
|---|---|
| `id` | Stable identifier of the case. Never renamed, never reused |
| `notation` | The `id` of the entry in `spec.json` this case exercises |
| `markdown` | The input, verbatim, including the frontmatter when there is one |
| `links` | The edges a conforming Indexer produces, in any order. Absent means the case makes no claim about links |
| `facets` | The attributes a conforming Indexer produces, as `name → { kind, values }`. Absent means the case makes no claim about attributes |

An expectation of `[]` or `{}` is a claim, and a strong one: it says the input produces **nothing**. Those cases carry as much of the specification as the positive ones, because the failure they prevent — a notation that quietly does nothing while somebody believes in it — is the failure a specification exists to prevent.

## Running it

The suite is data, not code: it carries no runner, so that an implementation in any language can consume it. An implementation feeds each `markdown` to its own extractors and compares the result.

Rules a runner has to follow:

- **Order does not matter** in `links`; identity does. Compare as sets keyed by `slug`.
- **A missing field is not an empty expectation.** A case with no `facets` key says nothing about attributes; a case with `"facets": {}` says there are none.
- **Every case must run.** Skipping a case is a conformance failure, not a local decision.

## Coverage

Every entry of `spec.json` whose `reader` is `links` or `frontmatter` has at least one case here. Entries whose reader is `reading-surface` are rendering, and are verified by the implementation against its own renderer: what a callout looks like is not something a JSON file can assert.
