# MemorySmith.app

**Structured knowledge we build and keep with the AI assistants we already use every day.**

MemorySmith hosts knowledge notebooks in Markdown that describe themselves: each notebook declares, as data, its Guidance (what it is for and how its notes are written), its folders and what each keeps, and a Template for the notes of each folder. A person reads and edits them on the web; an AI agent reaches the same notebooks through a remote MCP server and **writes in them**, obeying the notebook's own Guidance and Templates, with every change recording who wrote it and through which agent.

## How it works

- **For the person:** [memorysmith.app](https://memorysmith.app), a reading surface first and an editor on the same page, with links and backlinks, search, the graph of a notebook, the history of each note, attachments, sharing, export and print, in English and Portuguese.
- **For the agent:** the MCP connector at `https://mcp.memorysmith.app/mcp`, added to Claude or ChatGPT as a custom connector. The agent calls `whoami`, reads the notebook's context, and learns the method from the skills the server serves.
- **The notation:** notes are written in the [MemorySmith Markdown Specification](https://github.com/memorysmithapp/memorysmithapp-markdown), CommonMark and GFM with wikilinks, embeds, callouts and frontmatter, read the same way by the server, the interface and the agent.

Accounts are created on request. Once signed in, the *About* page says how to connect each client.

## The repository

A pnpm monorepo of three projects, deployed together to AWS:

| Project | Holds |
|---|---|
| [`memorysmithapp-backend`](memorysmithapp-backend) | Six bounded contexts (access, knowledge, discovery, audit, agent, portability), the shared kernel and the contracts, in TypeScript |
| [`memorysmithapp-frontend`](memorysmithapp-frontend) | The web interface, in React |
| [`memorysmithapp-infra`](memorysmithapp-infra) | All of the infrastructure in AWS CDK, and the commands that deliver and operate it |

## Run it locally

With Node.js 24 and Corepack enabled (`corepack enable`):

```sh
pnpm install
pnpm quality     # the checks of the documents and the version
pnpm test        # every unit suite
pnpm typecheck
```

The unit suites run with no AWS account. There is no local backend: the web interface runs against a deployed environment, from `memorysmithapp-frontend/config.local.json` (a copy of `config.example.json` filled in with that environment's app client) and `pnpm -C memorysmithapp-frontend dev`.

Deploying and operating an environment is in [`ARCHITECTURE.md` §5](docs/ARCHITECTURE.md#5-operation).

## The documents

| Document | Answers |
|---|---|
| [`AGENTS.md`](AGENTS.md) | How an agent works here: limits, invariants, verified commands |
| [`docs/PRD.md`](docs/PRD.md) | What the product solves and delivers, and its business rules |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How it is built and operated, its invariants and the decisions behind them |
| [`docs/SDLC.md`](docs/SDLC.md) | How a change travels from an issue to production |
| [`CHANGELOG.md`](CHANGELOG.md) | What changed in each version |

To report a problem or ask for something, [open an issue](https://github.com/memorysmithapp/memorysmithapp/issues/new).

## Licence

[MIT](LICENSE).
