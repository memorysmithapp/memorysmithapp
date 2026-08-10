# MemoryVault.guru

Cofres de conhecimento em **Markdown**, com estrutura declarada, acessíveis nativamente pelas ferramentas de IA.

O agente não só lê o vault — ele o **alimenta**. Lê um corpo de normas e escreve o conhecimento como notas, obedecendo às orientações do próprio vault; depois, outro trabalho usa essa base para produzir um relatório ou uma auditoria.

---

## O problema

O fluxo que funciona hoje é uma pasta local de `.md` com um `README.md` na raiz explicando ao agente como estruturar as notas. Funciona — e quebra em três pontos: o conteúdo é local (sem colaboração), não há cliente bom para lê-lo remotamente, e separar projetos vira um punhado de pastas soltas.

O MemoryVault.guru é o backend remoto desse fluxo.

## Como um vault é organizado

```
Vault
├── README.md          ← Guidance: para que serve este vault e como estruturar as notas
└── Pastas (ordenadas) ── cada uma com uma descrição: o que se guarda aqui
    ├── TEMPLATE.md    ← como as notas desta pasta se estruturam
    ├── subpastas
    └── notas .md
```

`README.md` e `TEMPLATE.md` são os dois únicos nomes reservados. Não são documentação: são **instruções executáveis** — é o que faz o agente escrever a nota certa, na pasta certa, no formato certo.

## Interface

O contrato público é um **MCP server remoto** (OAuth 2.1), conector nativo em Claude web, desktop, Code, Cowork e CLI. A chamada central é `get_vault_context`, que devolve o guidance integral mais a árvore anotada com descrições e ordem — o equivalente a ler o README e rodar `ls -R` na pasta local, em uma chamada.

Sobre isso: grafo de links (árvore de dependências e backlinks), busca semântica, histórico por revisão e uma UI de autoria.

## Arquitetura

| | |
|---|---|
| Stack | AWS Serverless · Node.js/TypeScript |
| Dados | DynamoDB (estrutura e metadados) + S3 (corpo dos `.md`) + S3 Vectors (embeddings) |
| IA | Bedrock — Titan Text Embeddings V2 |
| Desenho | DDD tático + Hexagonal (Ports & Adapters), um deployable por bounded context |
| Tenancy | Multi-tenant desde a primeira linha: `TenantId` na chave líder de todo item |

Seis serviços: `access`, `knowledge` (core), `discovery`, `audit`, `agent` (MCP), `portability`.

Três decisões que atravessam o resto:

- **O backend não interpreta o conteúdo.** O que vai dentro da nota — frontmatter inclusive — é decidido pelo Guidance e pelo Template do vault. O backend lê sintaxe universal de Markdown, nunca convenção de vault.
- **Tenant é tipo, não convenção.** Não existe caminho de código que construa uma chave sem `TenantId`: o compilador rejeita.
- **O passado é imutável.** A trilha de auditoria é append-only por política de IAM, não por disciplina — e cada evento carrega o `versionId` do S3, o que permite reler a base como ela estava na data em que um trabalho foi emitido.

## Documentação

**[DESIGN.md](DESIGN.md)** — arquitetura completa: modelo de domínio, invariantes, single-table design, portas e adaptadores, proveniência e histórico, e a sequência de construção.

## Estado

Fase de design. Ainda não há código.

O primeiro passo é um spike de autenticação: conectar um MCP mínimo autenticado por Cognito no Claude Desktop e no Claude web. É a decisão de maior risco do projeto — se a conexão não for fluida, a tese não se sustenta.

## Licença

MIT — ver [LICENSE](LICENSE).
