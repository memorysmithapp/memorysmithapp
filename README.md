# MemoryVault.guru

> SaaS de gestão de conhecimento em **Markdown**, organizado por uma **hierarquia
> organizacional multinível**.

O MemoryVault.guru não é "mais um editor de notas". A proposta é **organizar
estrutura e contexto em Markdown para leitura de agentes**: tenant → nó → vault →
pasta → nota formam uma grande árvore navegável de arquivos `.md`. Dentro dela,
`README.md` (no vault) e `TEMPLATE.md` (na pasta) são apenas **palavras reservadas**
— opcionais — que servem de contexto ao agente.

No fim, o backend é **um conjunto de `.md` no S3 + um índice no DynamoDB** que os
organiza. O conteúdo são os arquivos; a estrutura é ponteiro.

📄 A arquitetura completa está em **[DESIGN.md](DESIGN.md)**.

---

## A ideia em uma linha

```
Tenant → Organização → Departamento → Divisão → Projeto → Vault → Pasta → Nota
└──────── hierarquia = organização e escopo de acesso ────────┘   └── conteúdo Markdown ──┘
```

- **Vault** = pode ter um `README.md` (palavra reservada, opcional) que o descreve.
- **Pasta** = pode conter um `TEMPLATE.md` — molde **sugerido**, não uma trava.
- **Nota** = Markdown + YAML frontmatter livre.
- **Agente** (Fase 3) pede o `README.md` e o `TEMPLATE.md` via MCP **antes** de escrever.

Cada entidade tem uma **chave opaca estável**; o conteúdo vive no S3 sob essa chave
(`{vaultId}/README.md`, `{folderId}/{nota}.md`), com a hierarquia como ponteiro no
DynamoDB. Consequência: renomear e **mover são baratos** (só banco); só *apagar*
propaga para o S3 (ADR-021). O export reconstrói a árvore legível para abrir no
Obsidian.

Não há motor de configuração tipado, herança, procedência nem locks — removido de
propósito (ADR-017). Cada vault é autônomo (ADR-018).

---

## Princípios

| # | Princípio | Consequência prática |
|---|---|---|
| P1 | **No fim é tudo Markdown** | O backend organiza e serve; não gera Markdown de schema tipado |
| P2 | **Vault autônomo** | Cada vault se descreve no seu README; sem herança entre níveis |
| P3 | **Molde é sugestão, não contrato** | `TEMPLATE.md` orienta; a nota não precisa preencher tudo (seed) |
| P4 | **Hierarquia genérica, não fixa** | Uma tabela `Node` recursiva com `type`, não cinco tabelas |
| P5 | **Conteúdo portável** | Markdown + YAML puro; export reconstrói a árvore legível, abre no Obsidian |
| P6 | **Simples na Fase 1, escalável por design** | Leitura agora; escrita por agente e importador depois |
| P7 | **Isolamento por chave-líder** | Todo item de tenant começa com `T#{tenant_id}` |
| P8 | **Storage por ID opaco** | Conteúdo no S3 sob a chave estável da entidade; mover/renomear não toca no S3 |

---

## O que a Fase 1 entrega

A Fase 1 é uma **demo somente-leitura** sobre vaults reais, carregados por um script
de seed (ADR-014). O objetivo é validar o **núcleo do modelo** — não construir todas
as telas.

- Hierarquia de nós (organização + escopo de acesso)
- Vaults com `README.md` e pastas com `TEMPLATE.md` (convenções, opcionais)
- Notas em Markdown + frontmatter, com IDs estruturados preservados da fonte
- Storage no S3 por chave opaca; DynamoDB como índice navegável (`§6.1`)
- `GET /vaults/{id}/readme` e `/agent-context` servindo o contexto
- UI de leitura: árvore navegável, navegador de pastas, visualizador de nota e de template
- Export reconstruindo a árvore legível
- Autenticação mínima via Cognito com tenant e usuários semeados

### Critério de pronto

Os vaults reais carregam sem forçar o modelo e ficam **navegáveis** como uma árvore
de pastas e notas; onde há `README.md`/`TEMPLATE.md`, eles descrevem o vault de forma
que um agente conseguiria operar ali (`§11.2` do DESIGN). Não "as telas funcionam", e
sim **"a estrutura e o contexto descrevem o vault de verdade"**.

---

## Stack

**AWS Serverless.** Stack reduzido na Fase 1 (ADR-016):

- **CloudFront + S3** — SPA React
- **API Gateway HTTP API** — REST
- **Lambda** — Node 22, ARM64, esbuild, 512 MB
- **DynamoDB** — single-table, on-demand, PITR (indexa metadados)
- **S3** — conteúdo `.md` (incl. `README.md` e `TEMPLATE.md`), versionado, SSE-KMS
- **Cognito** — pool único, plano Essentials, Managed Login
- **CDK v2 (TypeScript)** — IaC

Toda a lógica de domínio vive em `packages/core` — **TypeScript puro, sem imports de
`@aws-sdk/*`** — testável em milissegundos. REST hoje e MCP na Fase 3 são adaptadores
finos sobre os mesmos casos de uso.

---

## Roadmap

| Fase | Foco | Marco de conclusão |
|---|---|---|
| **1** | Demo por seed | Vaults reais carregados; o README de cada um descreve o vault fielmente |
| **2** | Produto multi-tenant | Cadastro, aprovação, convites, papéis e o importador |
| **3** | Escrita por agente | Servidor MCP, alocação de ID, delegação atenuada |
| **4** | Produtividade e escala | Busca, histórico, backlinks, billing, SSO |

---

## Estrutura do repositório

> A definir conforme a implementação avança. A intenção de arquitetura
> (`packages/core` puro + adaptadores REST/MCP) está descrita em
> [DESIGN.md §7](DESIGN.md).

---

## Licença

[MIT](LICENSE).
