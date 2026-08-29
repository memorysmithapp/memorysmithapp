# Guia de Arquitetura
## MCP Server Remoto + AWS Serverless · DDD Hexagonal · Isolamento por assinatura

Este documento é a fonte da verdade para **como o produto é construído**. Descreve stack, estrutura do monorepo, modelo tático de domínio, portas e adaptadores, desenho de chaves, transações, projeções, infraestrutura, testes, CI/CD e a sequência de construção.

Para **o que** o produto faz e sob qual regra de negócio, ver [`software-vision.md`](software-vision.md). Este documento não repete regras `RN-XXX`, apenas as referencia. Para fatos gerais do domínio (Markdown, MCP, RAG, auditoria, LGPD), ver [`knowledge-base.md`](knowledge-base.md).

---

## Índice

1. [Overview](#1-overview)
2. [Princípios de engenharia](#2-princípios-de-engenharia)
3. [Bounded contexts e forma de deploy](#3-bounded-contexts-e-forma-de-deploy)
4. [Stack tecnológico](#4-stack-tecnológico)
5. [Estrutura do repositório e regra de dependência](#5-estrutura-do-repositório-e-regra-de-dependência)
6. [Modelo de domínio (DDD tático)](#6-modelo-de-domínio-ddd-tático)
7. [Portas e adaptadores](#7-portas-e-adaptadores)
8. [Isolamento por assinatura](#8-isolamento-por-assinatura)
9. [Persistência: DynamoDB + S3](#9-persistência-dynamodb--s3)
10. [Transações, concorrência e outbox](#10-transações-concorrência-e-outbox)
11. [Discovery: grafo, busca e facetas](#11-discovery-grafo-busca-e-facetas)
12. [Proveniência e histórico](#12-proveniência-e-histórico)
13. [MCP server](#13-mcp-server)
14. [API interna e autorização](#14-api-interna-e-autorização)
15. [Taxonomia de erros](#15-taxonomia-de-erros)
16. [Export](#16-export)
17. [Infraestrutura](#17-infraestrutura)
18. [Requisitos não-funcionais](#18-requisitos-não-funcionais)
19. [Estratégia de testes](#19-estratégia-de-testes)
20. [CI/CD](#20-cicd)
21. [Anti-padrões](#21-anti-padrões)
22. [Checklist de nova funcionalidade](#22-checklist-de-nova-funcionalidade)
23. [Estratégia de versionamento](#23-estratégia-de-versionamento)
24. [A linha entre microsserviços e monólito modular](#24-a-linha-entre-microsserviços-e-monólito-modular)
25. [Sequência de construção](#25-sequência-de-construção)
26. [Riscos técnicos](#26-riscos-técnicos)

---

## 1. Overview

### 1.1 Decisões fundadoras

| # | Decisão | Alternativa descartada |
|---|---|---|
| **D1** | **Acesso por agente via MCP server remoto** (OAuth 2.1, Streamable HTTP) | REST com token manual |
| **D2** | **DynamoDB guarda todo o significado; S3 guarda blobs de Markdown sem significado** | Só S3; PostgreSQL; um repositório git por vault |
| **D3** | **Isolamento por assinatura desde a primeira linha**, com `SubscriptionId` na chave líder de todo item, em todo serviço | Introduzir a fronteira depois, o que equivale a re-chavear tudo |
| **D4** | **Subscription → Vault**, em que a assinatura é a fronteira, a unidade de colaboração **e** o objeto de negócio | Tenant técnico separado da assinatura; nível intermediário de workspace (removido, `software-vision.md` §4.3) |
| **D5** | **DDD tático mais Hexagonal, um deployable por bounded context** como desenho-alvo | Monólito modular (ver §24) |
| **D6** | **Descoberta por grafo de links, por texto e por facetas, as três projeções de eventos.** A busca é literal e varre o vault sob o teto declarado; a vetorial foi retirada na 0.2.0 (§11.2) | Só busca por título |
| **D7** | **Proveniência e histórico imutável no núcleo** | Log de aplicação; versionamento apenas no S3 |

### 1.2 Topologia

```
                    ┌───────────────────────────────────────────┐
   Clientes de      │   svc-agent   (MCP · OAuth 2.1)           │
   agente (web,     │   Agent Access Context — BFF/ACL          │
   desktop, CLI) ──▶└───┬───────────────────────────┬───────────┘
                        │ HTTP interno (IAM)        │
   Web UI ─────┐        ▼                           ▼
               │  ┌──────────────────┐        ┌──────────────────────────┐
               ├─▶│  svc-knowledge   │══════▶ │  svc-discovery           │
               │  │  Knowledge Ctx   │eventos │  grafo de links          │
               │  │  ★ CORE DOMAIN   │  ║  ║  │  facetas de curadoria    │
               │  └────────┬─────────┘  ║  ║  └──────────────────────────┘
               │           │ authz      ║  ╚═▶┌──────────────────────────┐
               │           ▼            ║     │  svc-portability         │
               │  ┌──────────────────┐  ║     └──────────────────────────┘
               ├─▶│  svc-access      │══╝     ┌──────────────────────────┐
               │  │  Access Context  │═══════▶│  svc-audit  (append-only)│
               └─▶└──────────────────┘        └──────────────────────────┘
                     todos os eventos ────────────────▲
```

---

## 2. Princípios de engenharia

Contrapartida técnica dos princípios de produto (`software-vision.md` §2). Cada um tem um mecanismo que o torna verificável, porque princípio sem mecanismo é intenção.

| # | Princípio | Mecanismo que o garante |
|---|---|---|
| **PE1** | **O domínio não conhece a AWS** | `domain/` e `application/` sem um único `import` de SDK, com regra de dependência verificada no CI (§5.5) |
| **PE2** | **A assinatura é tipo, não convenção** | Construtores de chave aceitam apenas o value object `SubscriptionId`, criável só a partir da claim do JWT (§8) |
| **PE3** | **A chave do S3 é totalmente opaca** | A chave codifica apenas um `ContentId`; renomear, mover e reordenar não têm o que tocar nela (§9.2) |
| **PE4** | **O passado é imutável** | `Deny` de IAM em `UpdateItem` e `DeleteItem` na tabela de auditoria; sem `purge` na porta de conteúdo (§12) |
| **PE5** | **Descoberta é derivada** | Projeções reconstruíveis a partir dos eventos e dos `.md`; nenhuma é lida pelo core (§11) |
| **PE6** | **Nenhuma mutação anônima** | `Authorship` é argumento obrigatório de toda operação de agregado que muda estado (§6.1) |
| **PE7** | **Erro da AWS nunca chega ao domínio** | O adaptador traduz exceção de infraestrutura em `DomainError` tipado (§15) |
| **PE8** | **O caminho quente não tem ponto único de contenção** | Transação de nota não escreve no item `META` do vault (§10.2) |

---

## 3. Bounded contexts e forma de deploy

Seis contextos (mapa de responsabilidades em `software-vision.md` §6), **cada um dono exclusivo dos seus dados**: uma tabela DynamoDB por serviço, e nenhum serviço lê a tabela do outro.

| Serviço | Contexto | Tabela | Tipo |
|---|---|---|---|
| `svc-access` | Access | `mv-access` | Supporting |
| `svc-knowledge` | Knowledge | `mv-knowledge` | **Core** |
| `svc-discovery` | Discovery | `mv-discovery` | Supporting |
| `svc-audit` | Audit | `mv-audit` | Supporting |
| `svc-agent` | Agent Access | — (não persiste) | Supporting (ACL) |
| `svc-portability` | Portability | — (usa S3) | Generic |

### 3.1 Context map

- `svc-knowledge` → `svc-access`: **Customer/Supplier**. Knowledge consome decisões de autorização; Access não conhece Knowledge.
- `svc-agent` → demais: **Anticorruption Layer**. O vocabulário do MCP nunca vaza para o domínio (RN-AGT-008).
- `svc-discovery`, `svc-audit`, `svc-portability` ← todos: **Published Language** via eventos no EventBridge. Nenhum deles é consultado pelo core, apenas o alimentam.
- **Shared Kernel** (`memorysmith-backend/packages/kernel`): apenas primitivas sem regra, como `SubscriptionId`, `Ulid`, `Slug`, `Authorship`, `Result`, `DomainEvent` e a taxonomia de erros. Deliberadamente minúsculo, porque shared kernel grande é acoplamento disfarçado.

### 3.2 Forma de deploy

O desenho-alvo é de seis deployables (D5). **A 0.1.0 sai como monólito modular com `svc-audit` separado**, decisão detalhada em §24, com a alavanca de reversão explicitada. Contextos, agregados, portas e estrutura de pastas são idênticos nas duas formas; o que muda é o `composition-root.ts`.

---

## 4. Stack tecnológico

### 4.1 Backend

| Camada | Escolha | Nota |
|---|---|---|
| Runtime | Node.js 22 (LTS), TypeScript strict | ARM64 |
| Compute | AWS Lambda, **um por serviço** e não um por rota | Menos cold start, um composition root por deployable |
| Roteamento interno | Hono | Dentro do Lambda do serviço |
| API | API Gateway HTTP API por serviço, atrás de um CloudFront | Roteamento por path |
| Dados estruturais | DynamoDB on-demand, PITR habilitado | Uma tabela por serviço |
| Conteúdo | S3 com versionamento; Object Lock opcional por assinatura | Chaves opacas planas |
| Índice de conteúdo | Item `TEXT#` na `mv-discovery`, varrido na função | Sustentado pelo teto de 2.000 notas (§11.2) |
| Eventos | EventBridge (bus `mv-events`) e DynamoDB Streams para a outbox | |
| Identidade | Amazon Cognito user pool com trigger de *pre-token-generation* | Registro de cliente MCP via proxy CIMD (§13.3) |
| Validação | Zod, na borda e nos contratos de evento | Nunca dentro do domínio |
| Observabilidade | AWS Lambda Powertools | `subscriptionId` em toda linha de log |
| IaC | AWS CDK (TypeScript) | Projeto próprio, `memorysmith-infra` (§5.1, §5.4) |

### 4.2 Frontend

| Camada | Escolha |
|---|---|
| Framework | React + Vite (SPA) |
| Hospedagem | S3 + CloudFront |
| Estado de servidor | TanStack Query |
| Estado de cliente | Zustand |
| i18n | `en_US` canônico, `pt_BR` obrigatório (`CLAUDE.md` § Política de idioma) |
| Editor | Editor de Markdown com preview lado a lado |

### 4.3 Ferramentas

pnpm (workspaces) · Vitest · `dependency-cruiser` (§5.5) · ESLint + Prettier · DynamoDB Local e MinIO para testes de adaptador.

---

## 5. Estrutura do repositório e regra de dependência

### 5.1 Três projetos de topo

O repositório é um monorepo pnpm com **três projetos de primeiro nível**, nomeados a partir do identificador do projeto (`CLAUDE.md` → Identificador do projeto):

| Projeto | Contém | **Não** contém |
|---|---|---|
| **`memorysmith-backend/`** | Os seis bounded contexts, o kernel compartilhado e os contratos de evento. Todo o código de domínio, aplicação e adaptadores | Nenhuma linha de CDK, nenhum nome de stack, nenhuma referência a conta ou região |
| **`memorysmith-frontend/`** | A SPA React: telas, estado, i18n, cliente HTTP | Regra de negócio; nenhuma decisão que pertença ao domínio |
| **`memorysmith-infra/`** | Todo o CDK: stacks, constructs, políticas de IAM, pipeline | Nenhuma regra de negócio, nenhum handler |

> **Por que a infraestrutura é um projeto próprio, e não uma pasta dentro do backend.** Três razões, na ordem em que aparecem na prática:
>
> 1. **A infra descreve os três projetos**, não um. Ela cria o bucket que serve o frontend, o user pool que autentica os dois e o pipeline que faz o deploy de tudo. Morar dentro do backend a coloca num lugar que só é dono de parte do que ela declara.
> 2. **Permissão de deploy não é permissão de código.** Quem escreve domínio não precisa das credenciais que criam a conta; quem opera a conta não precisa ler regra de negócio. Projetos separados tornam esse recorte trivial no CI, no acesso do repositório e na revisão.
> 3. **Os ciclos de vida divergem.** Um refactor de agregado não republica stack; uma mudança de política de IAM não recompila o domínio. Misturá-los faz cada um disparar o build do outro.

**Regra de dependência entre projetos, em direção única:**

```
memorysmith-infra      →  referencia artefatos de backend e frontend (bundling, deploy)
memorysmith-backend    →  não conhece infra, não conhece frontend
memorysmith-frontend   →  consome @memorysmith/contracts (só tipos) e a API em runtime
```

Um `import` de `memorysmith-infra` dentro de `memorysmith-backend` é erro de arquitetura, não questão de gosto: significaria que o código de serviço conhece a conta AWS, o mesmo vazamento que PE1 impede uma camada abaixo.

### 5.2 `memorysmith-backend/`

```
memorysmith-backend/
├── packages/
│   ├── kernel/              # SubscriptionId, Ulid, Slug, Authorship, Result, DomainEvent, erros
│   └── contracts/           # schemas Zod dos eventos e dos DTOs: o único pacote que o frontend importa
├── services/
│   ├── access/
│   ├── knowledge/
│   ├── discovery/
│   ├── audit/
│   ├── agent/
│   └── portability/
│       └── src/
│           ├── domain/          # agregados, VOs, eventos, serviços de domínio, PORTAS
│           ├── application/     # casos de uso: orquestram domínio e portas
│           ├── adapters/
│           │   ├── inbound/     # HTTP (Hono), MCP, consumidores de evento
│           │   └── outbound/    # DynamoDB, S3, EventBridge
│           └── main/
│               └── handler.ts   # o entrypoint que a infra empacota
├── apps/
│   └── core-monolith/           # o composition root do deployable principal (§24)
│       └── src/
│           ├── composition-root.ts   # a única peça que muda entre monólito e microsserviço
│           ├── app.ts                # monta os contextos sob um prefixo cada
│           ├── handler.ts            # entrypoint da API
│           └── relay.handler.ts      # entrypoint do relay da outbox
├── package.json
└── tsconfig.json
```

O `apps/core-monolith` é o **único lugar que conhece dois contextos ao mesmo tempo**, e é por isso que ele existe em vez de um dos serviços importar o outro: a regra do §5.5 continua valendo entre `services/*`, e a composição fica fora dela, onde ela deve ficar.

Todo serviço tem exatamente a mesma estrutura interna de quatro camadas. Uniformidade aqui não é estética: é o que permite que a regra de dependência do §5.5 seja uma configuração só, válida para os seis.

### 5.3 `memorysmith-frontend/`

```
memorysmith-frontend/
├── public/
├── src/
│   ├── main.tsx                        # bootstrap: auth, i18n, query client
│   ├── app/
│   │   ├── router.tsx                  # lazy por feature
│   │   └── query-client.ts
│   ├── features/                       # uma pasta por área da UI (software-vision.md §13.1)
│   │   ├── vaults/                     # catálogo de vaults
│   │   ├── structure/                  # árvore: pastas, ordem, drag-and-drop
│   │   ├── guidance/                   # editor do Guidance do vault
│   │   ├── template/                   # editor do Template da pasta
│   │   ├── note/                       # leitura, edição, backlinks, relacionadas
│   │   ├── history/                    # linha do tempo e diff entre revisões
│   │   ├── search/                     # lexical, sobre titulo e pasta
│   │   ├── health/                     # links quebrados e órfãs
│   │   ├── members/                    # convites e papéis
│   │   └── connect/                    # URL do MCP e passo a passo por cliente
│   ├── i18n/
│   │   └── locales/{en_US.json, pt_BR.json}
│   └── shared/
│       ├── api/                        # cliente HTTP, interceptors, mapeamento de erro (§15)
│       ├── auth/                       # o único módulo que conhece o SDK de identidade
│       ├── components/                 # AppShell, árvore, editor de Markdown, ui/
│       ├── hooks/
│       ├── store/                      # Zustand: assinatura ativa, tema, locale
│       └── types/
├── index.html
├── vite.config.ts
└── .env.example
```

O mapeamento de erro para mensagem vive em `shared/api/error-mapper.ts` e cobre a taxonomia inteira do §15. Em particular, `FORBIDDEN` chega como `404` (§14.2) e a UI mostra "não encontrado": a interface não pode ser mais informativa que a API, ou o vazamento que o `404` evita volta pela tela.

### 5.4 `memorysmith-infra/`

```
memorysmith-infra/
├── bin/app.ts
├── stacks/
│   ├── network.stack.ts             # Route 53 (hosted zone), CloudFront, certificados ACM (§17)
│   ├── identity.stack.ts            # Cognito user pool + pre-token-generation (§8.3)
│   ├── storage.stack.ts             # bucket de conteúdo (versionado)
│   ├── events.stack.ts              # EventBridge bus mv-events
│   ├── access.stack.ts              # tabela mv-access + Lambda + authorizer
│   ├── knowledge.stack.ts           # tabela mv-knowledge + Lambda + stream da outbox
│   ├── discovery.stack.ts           # tabela mv-discovery + Lambda projetora
│   ├── audit.stack.ts               # tabela mv-audit + Lambda com role APPEND-ONLY (§12.2)
│   ├── agent.stack.ts               # MCP server + resource server OAuth + CIMD proxy (§13.3)
│   ├── portability.stack.ts
│   ├── frontend-hosting.stack.ts    # S3 + CloudFront OAC para memorysmith-frontend
│   └── pipeline.stack.ts            # CI/CD (§20)
├── constructs/
│   ├── service-lambda.ts            # Lambda + Powertools + alarmes obrigatórios (§17)
│   ├── subscription-table.ts        # tabela DynamoDB com PITR e streams
│   └── append-only-table.ts         # tabela + role com Deny explícito em Update/Delete
├── cdk.json
└── package.json
```

Dois constructs carregam garantia de arquitetura, não conveniência:

- **`append-only-table`** é onde PE4 deixa de ser política e vira permissão. O `Deny` explícito em `UpdateItem` e `DeleteItem` mora aqui, e é aqui que o teste de imutabilidade do §19 aponta.
- **`service-lambda`** garante que nenhum serviço vá para produção sem Powertools e sem os alarmes do §17. Esquecer observabilidade deixa de ser possível por omissão.

**Um stack por serviço, mais os stacks compartilhados.** Quando a 0.1.0 sair como monólito modular (§24), os stacks de serviço colapsam em dois, um para o deployable principal e um para o `svc-audit`, sem que `stacks/` mude de forma: o que muda é quais são instanciados em `bin/app.ts`.

### 5.5 Regra de dependência entre camadas (verificada no CI)

Dentro de cada serviço de `memorysmith-backend/services/*`:

```
domain/       →  importa apenas de si mesmo e de packages/kernel
application/  →  importa apenas de domain/ e packages/kernel
adapters/     →  importa de application/, domain/, kernel e SDKs
main/         →  importa de tudo (é o único lugar que conhece o mundo)
```

Configurada em `dependency-cruiser` e executada em todo pull request. **O build quebra se `domain/` importar SDK da AWS.** Sem essa checagem, hexagonal vira nomenclatura de pastas em três sprints (PE1).

A mesma configuração declara as regras entre projetos do §5.1: `memorysmith-backend` e `memorysmith-frontend` não podem importar de `memorysmith-infra`, e nenhum serviço pode importar de outro. A comunicação entre contextos é por HTTP com IAM ou por evento (§3.1), nunca por `import`.

---

## 6. Modelo de domínio (DDD tático)

### 6.1 `Vault`, Aggregate Root do Knowledge Context

Fronteira de consistência: o vault e **toda a sua árvore de pastas**.

```typescript
// memorysmith-backend/services/knowledge/src/domain/vault/Vault.ts — zero imports de AWS
export class Vault {
  private constructor(
    private readonly id: VaultId,
    private name: VaultName,
    private description: ShortText,
    private guidance: ContentRef | null,       // ponteiro opaco; o agregado nunca vê o Markdown
    private readonly folders: FolderTree,
    private version: number,
  ) {}

  static create(...): Result<Vault, DomainError>

  addFolder(parentId: FolderId | null, name: FolderName, description: FolderDescription, by: Authorship): Result<Folder>
  renameFolder(id: FolderId, name: FolderName, by: Authorship): Result<void>
  describeFolder(id: FolderId, description: FolderDescription, by: Authorship): Result<void>
  moveFolder(id: FolderId, newParentId: FolderId | null, after: FolderId | null, by: Authorship): Result<void>
  reorderFolder(id: FolderId, after: FolderId | null, by: Authorship): Result<void>
  removeFolder(id: FolderId, policy: RemovalPolicy, by: Authorship): Result<void>
  attachTemplate(id: FolderId, ref: ContentRef, by: Authorship): Result<void>
  setGuidance(ref: ContentRef, by: Authorship): Result<void>

  pullEvents(): DomainEvent[]
}
```

`Authorship` é argumento obrigatório de toda operação que muda estado (PE6). Não há mutação anônima no domínio, porque a assinatura do método torna isso impossível, e é o que garante que o evento emitido sempre saiba quem o causou.

**Invariantes que só o agregado pode garantir**, e que por isso definem a fronteira:

| # | Invariante | Regra de negócio |
|---|---|---|
| I1 | `slug` único entre irmãs | RN-KNW-002 |
| I2 | Profundidade máxima 6 | RN-KNW-003 |
| I3 | Mover pasta nunca cria ciclo | RN-KNW-004 |
| I4 | Toda pasta tem `Position` | RN-KNW-005 |
| I5 | Remover pasta com filhas exige `RemovalPolicy` explícita | RN-KNW-007 |
| I6 | `Guidance` e `Template` são `ContentRef`; o agregado nunca carrega o Markdown | PP4 |

### 6.2 `Note`, Aggregate Root separado

```typescript
export class Note {
  private constructor(
    private readonly id: NoteId,
    private vaultId: VaultId,
    private folderId: FolderId,
    private title: NoteTitle,
    private slug: Slug,
    private position: Position,         // ordem dentro da pasta (§6.4)
    private body: ContentRef,           // ponteiro opaco para um Content Slot (§9.2)
    private readonly createdBy: Authorship,
    private updatedBy: Authorship,
    private deletedAt: Instant | null,  // soft delete (§12.4)
    private version: number,
  ) {}

  static create(...): Result<Note, DomainError>

  retitle(title: NoteTitle, by: Authorship): Result<void>
  replaceBody(ref: ContentRef, by: Authorship): Result<void>
  reorder(after: NoteId | null, by: Authorship): Result<void>
  moveTo(vault: VaultId, folder: FolderId, onSlugConflict: SlugConflictPolicy, by: Authorship): Result<void>
  delete(by: Authorship): Result<void>          // marca; não destrói conteúdo
  pullEvents(): DomainEvent[]
}
```

> **Por que `Note` ficou fora do agregado `Vault`?** Se estivesse dentro, criar uma nota exigiria carregar e travar a árvore inteira, e as invariantes de estrutura não dependem do conteúdo das notas. A regra "uma pasta com notas não pode ser removida sem política" é **consistência eventual** (via evento), não invariante transacional. É a decisão de modelagem mais importante do sistema, porque é ela que mantém escrita de nota barata e concorrente, e escrita de nota é o caminho quente por onde o agente alimenta o vault.

Detalhes que decorrem disso:

- `vaultId` **não é `readonly`**: mover entre vaults é operação de primeira classe e o `NoteId` é preservado (RN-KNW-023). É o que mantém a linha do tempo íntegra no `svc-audit`, cuja chave é por sujeito e não por vault (§12.2). "Mover" implementado como delete mais create perderia o histórico exatamente onde ele importa.
- `SlugConflictPolicy` (`REJECT` \| `RENAME`) existe porque o slug é único **dentro do vault** (RN-KNW-020), e portanto só a mudança de vault pode colidir.
- `replaceBody` recebe um `ContentRef` já gravado: quem fala com o S3 é o caso de uso, nunca o agregado (§10.3).
- `delete` marca, não destrói: o `bodyRef` permanece e a linha do tempo continua legível por `NoteId`.

> **A separação dos agregados só vale se a persistência a respeitar.** Ter `Note` fora de `Vault` no domínio não adianta nada se toda gravação de nota ainda escrever no item que representa o vault. A regra que fecha o argumento está em §10.2: **transação de nota nunca toca no item `META`**. Sem ela, a decisão desta seção é declaração de intenção.

### 6.3 Demais agregados

| Agregado | Contexto | Invariantes |
|---|---|---|
| `Subscription` | Access | Exatamente um `owner` (RN-ACC-001), garantido por ser um campo e não uma coleção; transições de status válidas apenas conforme a máquina de `software-vision.md` §4.4; motivo obrigatório na rejeição; o `SubscriptionId` é `readonly` e nenhum método o toca (§8.1) |
| `Subscription` | Access | Exatamente um `OWNER`, sempre presente; e-mail único entre membros; convite pendente não é membro; papel de membro é `EDITOR` ou `VIEWER`, já que `OWNER` não é membership (§9.4) |
| `NoteGraph` · `VaultIndex` | Discovery | Projeções, reconstruíveis a qualquer momento (PE5) |
| `AuditTrail` | Audit | Append-only: a única operação é `append` |

### 6.4 Value Objects

`SubscriptionId` `VaultId` `FolderId` `NoteId` `ContentId` (ULID) · `Slug` · `Position` · `FolderDescription` (de 1 a 500 caracteres, obrigatória) · `ContentRef` · `Revision` · `SlugConflictPolicy` · `RemovalPolicy` · `ErasureReason` · `SubscriptionStatus` · `Role` · `VaultRoleLimit` · `Authorship` · `AgentIdentity` · `LinkTarget`.

`Role` é uma enumeração **ordenada** (`NONE < VIEWER < EDITOR < OWNER`) e expõe `Role.min(a, b)`. É essa ordem que permite escrever o teto de vault como um mínimo (§14.2) em vez de uma cadeia de condicionais, e é ela que torna impossível, por tipo, que um teto promova alguém.

Todos imutáveis, autovalidados no construtor, comparados por valor. **Nenhuma `string` crua cruza a fronteira do domínio.**

> `ContentRef` carrega `ContentId`, não um caminho. Uma `key` de S3 é um conceito com forma de S3, e tê-la dentro de um VO do domínio arranharia PE1 sem que a regra de dependência do CI reclamasse, porque uma `string` não importa nada. Montar `s/{subscriptionId}/c/{contentId}.md` é responsabilidade exclusiva do adaptador.

#### `Position`, ordenação por índice fracionário

A ordem é requisito de produto (PP9) e vale para pastas entre pastas e para notas dentro da pasta. A forma ingênua, um campo `order` inteiro denso, obriga a reescrever todos os irmãos a cada arraste: em DynamoDB, N writes numa transação com teto de 100 itens.

Usamos **índice fracionário lexicográfico**: cada item guarda uma chave string, e inserir entre `"a0"` e `"a1"` gera `"a0V"`. **Reordenar é um único write no item movido**, independente do número de irmãos.

```typescript
Position.between(prev: Position | null, next: Position | null): Position
```

Empates, possíveis sob concorrência, são desempatados pelo ULID do item, de modo que a ordenação nunca fica indefinida. Quando uma chave passa de 12 caracteres, um comando de rebalanceamento redistribui os irmãos; é manutenção rara, não caminho quente.

### 6.5 Eventos de domínio

```
Access:     SubscriptionRequested · SubscriptionApproved · SubscriptionRejected
            SubscriptionSuspended · SubscriptionReactivated · SubscriptionCanceled
            OwnershipTransferred · MemberInvited · MemberJoined
            MemberRoleChanged · MemberRemoved · VaultRoleLimitSet · VaultRoleLimitCleared
Knowledge:  VaultCreated · VaultRenamed · GuidanceUpdated · FolderAdded · FolderRenamed
            FolderDescribed · FolderMoved · FolderReordered · FolderRemoved · TemplateUpdated
            NoteCreated · NoteUpdated · NoteReordered · NoteMoved · NoteDeleted · NoteRestored
Discovery:  NoteLinksResolved · NoteIndexed · LinkBroken
Admin:      ContentErased      (o único evento que registra destruição de conteúdo)
```

Todo evento carrega `subscriptionId` e `Authorship`. **Eventos de conteúdo carregam o `ContentRef` completo**, com `contentId`, `versionId`, `sha256` e `bytes`, e não só o `versionId`: é isso que torna a trilha de auditoria um índice de recuperação suficiente para reconstruir o mapeamento entre DynamoDB e S3 do zero (§9.2, §12.3). `NoteMoved` carrega origem e destino (`vaultId`, `folderId`), porque quem consome precisa dos dois lados.

Publicados via **outbox transacional** (§10.4). Adicionar consumidor não toca no core.

### 6.6 Serviços de domínio

- **`FolderTreePlacement`** resolve "colocar depois de X dentro de Y" em `(parentId, Position)`, validando I2 e I3.
- **`LinkExtractor`** extrai `[[wikilinks]]` e links Markdown relativos do **corpo** da nota. Só sintaxe universal: nenhum nome de campo, nenhuma convenção de vault (PP4). Regra de resolução em §11.1.
- **`VaultContextComposer`** monta o Vault Context a partir do agregado e do `ContentStore`. **Vive no domínio porque o formato desse documento é o produto** (`software-vision.md` §9.2), não detalhe de apresentação.
- **`AuthorizationPolicy`** decide `(papel na assinatura, teto do vault, ação)`. É serviço de domínio, não porta de infraestrutura (§14.2).

---

## 7. Portas e adaptadores

### 7.1 Portas do Knowledge

```typescript
// domain/ports/VaultRepository.ts
export interface VaultRepository {
  findById(id: VaultId): Promise<Vault | null>;   // sem subscriptionId no argumento — ver §8
  save(vault: Vault): Promise<Result<void, ConcurrencyError>>;
}

// domain/ports/NoteRepository.ts
export interface NoteRepository {
  findById(vault: VaultId, id: NoteId): Promise<Note | null>;
  findBySlug(vault: VaultId, slug: Slug): Promise<Note | null>;
  save(note: Note): Promise<Result<void, ConcurrencyError>>;
}

// domain/ports/ContentStore.ts
export interface ContentStore {
  create(markdown: string): Promise<ContentRef>;                       // novo slot, primeira revisão
  overwrite(slot: ContentId, markdown: string): Promise<ContentRef>;   // nova revisão do mesmo slot
  read(ref: ContentRef): Promise<string>;                              // a revisão exata do ref
}

// domain/ports/EventPublisher.ts
export interface EventPublisher { publish(events: DomainEvent[]): Promise<void>; }
```

**Não há `purge` na porta `ContentStore`, e a ausência é deliberada.** Nenhum caso de uso de domínio pode destruir uma revisão: se pudesse, apagar uma nota quebraria em silêncio a reconstrução histórica que §12.3 promete. Destruir conteúdo é ato administrativo, tem porta própria e evento próprio (§12.4, RN-AUD-007).

### 7.2 Adaptadores

| Porta | Adaptador de produção | Adaptador de teste |
|---|---|---|
| `VaultRepository` · `NoteRepository` | `DynamoVaultRepository` · `DynamoNoteRepository` | `InMemory*` |
| `ContentStore` | `S3ContentStore` | `InMemoryContentStore` |
| `EventPublisher` | `OutboxEventPublisher` (grava na mesma transação) | `RecordingEventPublisher` |
| `LinkGraph` | `DynamoLinkGraph` | `InMemoryLinkGraph` |
| `ContentIndex` | `DynamoContentIndex` | `InMemoryContentIndex` |
| `AccessPolicy` | `HttpAccessPolicy` \| `LocalAccessPolicy` (§24) | `StubAccessPolicy` |

O domínio de Discovery conhece `Edge`, `Depth`, `Facet` e `QueryNode`, e nunca conhece AWS. A linguagem de consulta inteira vive em `SearchQuery.ts`, sem I/O.

---

## 8. Isolamento por assinatura

Introduzir a fronteira depois significa reescrever cada chave, cada índice, cada consulta e cada objeto do S3, e por isso ela entra antes de qualquer outra coisa (D3). Regras de negócio correspondentes: `software-vision.md` §4.8.

### 8.1 O identificador é perpétuo

A assinatura acumula dois papéis: objeto de negócio com estado e fronteira de isolamento (`software-vision.md` §4.2). A regra técnica que torna isso seguro:

> **O `SubscriptionId` é emitido uma vez e nunca muda** (RN-SUB-005). Nenhuma transição de status, seja aprovar, suspender, cancelar ou reativar, escreve numa chave. `canceled` é um campo do item `META`, e o dado continua exatamente onde estava, alcançável no instante em que a assinatura voltar a `active`.

Consequência de desenho, e não detalhe de implementação: **nenhum código de persistência pode consultar o status para montar uma chave.** Status é decisão de autorização (§14.2), e vive na borda. Se um dia um repositório precisar saber o status, a fronteira vazou para a camada errada.

### 8.2 Três camadas de isolamento

**1. Chave líder.** Todo item de todo serviço começa por `S#{subscriptionId}`. Toda chave do S3 começa por `s/{subscriptionId}/`. Nenhuma consulta existe sem o prefixo, então não há query que possa, mesmo por engano, atravessar assinaturas.

**2. Tipo, não disciplina (PE2).** As portas de repositório recebem um `SubscriptionContext` no construtor, e os construtores de chave só aceitam `SubscriptionId`, um value object criável apenas a partir da claim do JWT.

```typescript
// adapters/outbound/dynamodb/DynamoVaultRepository.ts
export class DynamoVaultRepository implements VaultRepository {
  constructor(private readonly sub: SubscriptionContext, private readonly db: DynamoDBDocumentClient) {}
  // a assinatura é do repositório, resolvida por requisição — nunca argumento de método
}
```

O composition root instancia os repositórios **por requisição**, com a assinatura vinda do token. Não existe caminho de código que construa um repositório sem assinatura: o compilador rejeita. Isso troca uma regra que depende de code review por uma que depende do `tsc`.

**3. Origem do `SubscriptionId`: sempre a claim, nunca a requisição.** O `subscriptionId` sai do JWT (claim customizada, injetada pelo *pre-token-generation* do Cognito) e **jamais** do path, query ou body (RN-SUB-002). É o que fecha a porta de IDOR: pedir `/vaults/{id}` de outra assinatura devolve `404`, porque a chave montada nem chega lá.

> **Ponto de extensão.** Para clientes que exijam isolamento criptográfico forte, o passo seguinte é credencial STS por requisição com `dynamodb:LeadingKeys` e prefixo de S3 na *session policy*, ou seja isolamento no IAM e não na aplicação. O `SubscriptionContext` já é onde a credencial seria resolvida; ligá-lo é configuração, não redesenho.

### 8.3 As duas exceções nomeadas

Duas perguntas do produto precisam atravessar a fronteira. Nenhuma revela conteúdo, e ambas são declaradas aqui, porque deixá-las implícitas seria pior que nomeá-las.

**Exceção 1: os vínculos do usuário.** Identidade é global; assinatura é vínculo (RN-SUB-011). O `UserId` é o `sub` do Cognito e não pertence a assinatura nenhuma:

```
Vínculo   PK: USER#{userId}   SK: SUB#{subscriptionId}   { isOwner, joinedAt, isDefault }
```

Responde *"de quais assinaturas eu participo?"* e nada mais (RN-SUB-003).

**Exceção 2: a fila da plataforma.** O `PLATFORM_ADMIN` precisa listar assinaturas por status para aprová-las. Um GSI em `mv-access` resolve, projetando **apenas metadados**:

```
GSI2:  PK: PLATFORM#{status}   SK: REQUESTED#{timestamp}#{subscriptionId}
       projeção: name, ownerEmail, status, requestedAt, memberCount
```

A projeção é `INCLUDE`, não `ALL`, e a lista de atributos é a garantia: **o índice não carrega nada além do que a tela de plataforma mostra**. Ampliá-la é uma decisão de privacidade, não uma otimização, e por isso a lista está escrita aqui.

### 8.4 A sessão de plataforma não carrega assinatura

O `PLATFORM_ADMIN` opera fora de qualquer assinatura (`software-vision.md` §4.6), e a garantia é estrutural:

> **Um token de plataforma não tem claim `subscription_id`.** Como o `SubscriptionContext` só se constrói a partir dessa claim, e todo repositório exige um no construtor, **nenhum caso de uso do Knowledge é sequer instanciável** sob essa sessão. A tentativa falha na composição, antes de qualquer verificação de papel.

É o mesmo mecanismo de PE2 trabalhando na direção contrária: o tipo que impede um usuário de alcançar a assinatura errada impede o admin de alcançar qualquer uma. O teste correspondente está em §19, e ele verifica **por que** falhou, porque um teste que passasse porque alguém escreveu um `if` não provaria a propriedade.

O `svc-access` é o único serviço com rotas que aceitam sessão de plataforma, e elas leem exclusivamente pelo `GSI2` de §8.3.

### 8.5 Assinatura ativa no token

O trigger de *pre-token-generation* lê o atributo `active_subscription` do usuário, confirma que existe vínculo correspondente e injeta a claim `subscription_id`. Sem vínculo válido, cai no vínculo marcado como `isDefault` (RN-SUB-012). Trocar de assinatura é atualizar o atributo e renovar o token (`POST /session/subscription`, §14.1). **Nenhuma requisição de negócio jamais recebe `subscriptionId`**.

O trigger injeta também a claim `subscription_status`, lida do item `META`. Ela existe para que o authorizer recuse acesso a assinatura fora de `trial` ou `active` (RN-SUB-007) sem uma leitura extra por requisição. Como ela envelhece junto com o token, a suspensão leva o tempo de vida do token para surtir efeito, de mesma natureza que o atraso de 5 minutos do §14.2 e declarada pelo mesmo motivo.

Para o conector MCP, o `subscription_id` entra no token de acesso no instante do consentimento e não muda durante a vida daquele token (RN-SUB-014). Um conector, uma assinatura.

---

## 9. Persistência: DynamoDB + S3

### 9.1 A divisão

| Onde | O quê | Por quê |
|---|---|---|
| **DynamoDB** | **Todo o significado**: estrutura, ordem, descrições, identidade da nota (título, slug, pasta, autoria), qual blob é guidance e qual é template, membros, arestas do grafo, trilha de auditoria | Consultável, transacional, condicional |
| **S3** | **Blobs de Markdown sem significado**, endereçados por ID opaco, em todas as revisões | Sem teto de 400 KB, versionamento nativo, custo por GB menor |

A divisão não é "metadado aqui, conteúdo ali". É mais forte: **o S3 não sabe o que guarda.** Vault, pasta e nota são conceitos lógicos que existem inteiramente no DynamoDB; no S3 há uma pilha plana de blobs, todos iguais entre si.

### 9.2 Content Slots, o elo entre DynamoDB e S3

**A chave.** Uma só forma, para todo blob do sistema:

```
s/{subscriptionId}/c/{contentId}.md
```

`contentId` é um ULID gerado na criação do slot. `subscriptionId` está ali porque é fronteira de isolamento no IAM (§8.1), não porque signifique algo sobre o conteúdo. O sufixo `.md` é cortesia com humanos e `Content-Type`; nada o lê.

A chave **não codifica vault, pasta, nome nem papel**. Essa é a diferença entre "opaco" como intenção e "opaco" como propriedade estrutural: renomear, mover ou reordenar não pode tocar no S3, porque não existe na chave nenhum campo que essas operações mudariam. Não é uma regra a defender em cada operação nova, é uma impossibilidade (PE3).

**O elo.** O DynamoDB nunca guarda Markdown; guarda um ponteiro para uma **revisão específica** de um slot:

```typescript
export class ContentRef {                      // VO imutável
  constructor(
    readonly contentId: ContentId,             // qual slot
    readonly versionId: S3VersionId,           // qual revisão dele
    readonly sha256: Sha256,                   // integridade e detecção de "mudou ou não"
    readonly bytes: number,                    // tamanho, sem precisar de HEAD
  ) {}
}
```

| Campo | Trabalho que faz |
|---|---|
| `contentId` | Endereça o slot. Guardado explicitamente, nunca derivado do `NoteId`: um dia o mesmo slot pode ser apontado por outro papel |
| `versionId` | Transforma "aponta para o conteúdo" em "aponta para o conteúdo **daquele instante**". É a base de `read_note(asOf)` e de §12.3 |
| `sha256` | Se o hash do conteúdo novo é igual ao atual, não há gravação, não há evento e não há reprojeção (RN-KNW-028) |
| `bytes` | Tamanho para a UI e para os limites, de graça |

O `S3ContentStore` é quem sabe que `contentId` vira `s/{subscriptionId}/c/{contentId}.md`, e o `subscriptionId` ele obtém do `SubscriptionContext` do construtor, nunca do argumento.

**Um slot nunca é compartilhado.** Chave opaca puxa para endereçamento por conteúdo (`c/{sha256}.md`), com deduplicação de graça. Não fazemos, por três razões: dedup entre assinaturas compartilharia objeto atravessando a fronteira do §8.1 e daria um oráculo de existência; dedup dentro da assinatura exigiria contagem de referências e tornaria "apagar uma nota" uma operação que pode não apagar nada; e o Object Lock (§12.3) é por objeto, então dois donos disputariam uma retenção só. O `sha256` fica onde está, como campo de integridade e não como endereço.

**Custo de mover.** É a propriedade que o desenho compra:

| Operação | S3 | DynamoDB | Projeções |
|---|---|---|---|
| Renomear / reordenar pasta | 0 bytes | 1 transação (2 writes): item `FOLDER` + lock otimista do `META` | — |
| Reordenar nota | **0 bytes** | 1 transação (2 writes): `position` no item `NOTE`, evento | — |
| Mover nota entre pastas | **0 bytes** | 1 transação (2 writes + 1 check): `folderId`/`position` no item `NOTE`, `ConditionCheck` na pasta de destino, evento | Reprojeção da nota (§11.2) |
| Mover nota entre vaults | **0 bytes** | 1 transação (6 writes + 2 checks): `Delete`+`Put` do item `NOTE` (a PK muda), `Delete`+`Put` do guard de slug, `ConditionCheck` no vault e na pasta de destino, evento | Reprojeção + poda das arestas na origem |
| Trocar o corpo da nota | 1 `PutObject` | 1 transação (2 writes): item `NOTE`, evento | Reprojeção de links e facetas |

Mover entre vaults é a **única operação do sistema que escreve em duas partições de vault na mesma transação**. Ela não trava nenhum dos dois vaults: a árvore não muda, então bastam `ConditionCheck` de existência. O guard de slug da origem é apagado junto com o item, e esquecê-lo prenderia aquele slug no vault de origem para sempre.

**A troca: o bucket fica ilegível para humanos.** Duas respostas, ambas baratas:

1. **Metadados imutáveis no `PutObject`**, com `subscription-id`, `content-id` e `created-at`. Só o que nunca muda. Deliberadamente **não** gravamos `vaultId`, `folderId` nem título: viram mentira no primeiro move, e mantê-los atualizados devolveria ao S3 justamente a escrita que estamos eliminando.
2. **A trilha de auditoria é o índice de recuperação.** Como todo evento de conteúdo carrega o `ContentRef` completo (§6.5), o `svc-audit` contém toda tupla `(noteId, contentId, versionId)` que já existiu. Perdida a tabela do Knowledge além da janela de PITR, o mapeamento é reconstruível a partir dela.

### 9.3 Single-table design: `mv-knowledge`

| Item | PK | SK | Atributos |
|---|---|---|---|
| Vault | `S#{s}#VAULT#{v}` | `META` | name, slug, description, **guidanceRef**, version |
| Folder | `S#{s}#VAULT#{v}` | `FOLDER#{folderId}` | parentFolderId, name, slug, description, position, **templateRef** |
| Contador de pasta | `S#{s}#VAULT#{v}` | `FSTAT#{folderId}` | noteCount, updatedAt (projeção assíncrona, §10.3) |
| Contador de vault | `S#{s}#VAULT#{v}` | `FSTAT` | noteCount, updatedAt; indexado no `GSI1` como `VSTAT#{v}` |
| Teto de papel no vault | `S#{s}#VAULT#{v}` | `LIMIT#{userId}` | limit (`VIEWER`), setBy, setAt: o rebaixamento de §5.3 do produto |
| Note | `S#{s}#VAULT#{v}` | `NOTE#{noteId}` | folderId, title, slug, position, **bodyRef**, createdBy, updatedBy, version, `deletedAt?`, `deletedBy?` |
| Guard de slug de pasta | `S#{s}#VAULT#{v}` | `SLUG#{parentId}#{slug}` | garante I1 via `attribute_not_exists` |
| Guard de slug de nota | `S#{s}#VAULT#{v}` | `NSLUG#{slug}` | slug de nota é único **no vault** (RN-KNW-020) |
| Dedup da projeção | `S#{s}#VAULT#{v}` | `SEEN#{eventUlid}` | ttl; torna o contador exatamente-uma-vez |
| Outbox | `S#{s}#VAULT#{v}` | `EVENT#{ulid}` | payload, ttl |

Os três `…Ref` são `ContentRef` serializado, **o único elo com o S3 em todo o sistema**.

**A ordem lexicográfica das sort keys é escolhida, não acidental.** `FSTAT#` e `LIMIT#` caem entre `FOLDER#` e `META`, então o agregado inteiro, os contadores **e** os tetos de papel vêm num único `Query`, numa única partição:

```
Query  PK = S#{s}#VAULT#{v}   AND   SK BETWEEN 'FOLDER#' AND 'META'
→ todas as pastas + todos os contadores + todos os tetos + o item META
       FOLDER#…    FSTAT / FSTAT#…       LIMIT#…          META
```

`EVENT#` fica antes da faixa; `NOTE#`, `NSLUG#`, `SEEN#` e `SLUG#` ficam depois. É essa propriedade que faz `get_vault_context` devolver a árvore anotada com o número de notas de cada pasta **sem uma consulta por pasta**.

> **`LIMIT#` foi nomeado para cair nessa faixa, e o nome também descreve o que ele é**, um teto e não uma concessão (o teto só rebaixa, RN-ACC-011). A alternativa seria uma segunda consulta por requisição, no caminho mais quente do sistema, para responder uma pergunta de autorização que precisa ser respondida **antes** de tudo (§14.2). O custo é carregar os tetos de todos os membros junto com o vault; como membros são dezenas e a partição é a mesma, é grátis em latência.

| Índice | PK | SK | Serve |
|---|---|---|---|
| `GSI1` | `S#{s}#VAULTS` | `VAULT#{v}` · `VSTAT#{v}` | listar os vaults da assinatura, já com a contagem |
| `GSI2` | `S#{s}#FOLDER#{f}` | `NOTE#{position}#{noteId}` | listar notas de uma pasta, **na ordem definida** |

`GSI2` é **esparso**: os atributos que formam sua chave só existem enquanto `deletedAt` não existe. Nota apagada some das listagens sem uma linha de filtro em lugar nenhum (§12.4). Ordenação alfabética continua disponível como ordenação de exibição, feita no cliente sobre o resultado.

### 9.4 `mv-access`

```
S#{s}              / META                  → assinatura: ownerId, status, type, quota,
                                             requestedAt, reviewedBy, rejectionReason, legalHold
S#{s}              / USER#{userId}          → usuário conhecido pela assinatura
S#{s}              / INVITE#{token}         → convite pendente (ttl = expiresAt)
S#{s}              / MEMBER#{userId}        → membership: role (EDITOR | VIEWER)
USER#{userId}      / SUB#{subscriptionId}   → vínculo (§8.3, exceção 1)

GSI2:  PLATFORM#{status}     → REQUESTED#{timestamp}#{subscriptionId}  → fila da plataforma (§8.3, exceção 2)
                               projeção INCLUDE: ownerEmail, status, type, quota,
                               requestedAt, memberCount
```

**O `OWNER` não é um item `MEMBER`.** A titularidade mora em `ownerId`, no item `META` da assinatura: um campo único, que é como RN-ACC-001 ("exatamente um `OWNER`") deixa de ser regra a verificar e passa a ser forma do dado. A transferência de titularidade é um `Update` condicional nesse campo mais o `Put` do membership `EDITOR` do titular anterior, numa transação (RN-ACC-002).

O convite tem TTL igual à sua expiração: convite vencido some sozinho, sem job de limpeza e sem uma verificação de data espalhada por cada leitura.

---

## 10. Transações, concorrência e outbox

Toda mutação é **um** `TransactWriteItems`, mas há **duas formas** de transação, e a diferença entre elas é o que mantém a escrita de nota barata (§6.2).

### 10.1 Forma A: mutação da árvore (agregado `Vault`)

Criar, renomear, descrever, mover, reordenar ou remover pasta; trocar guidance ou template.

1. `Update` no item `META` com `ConditionExpression: version = :expected`, que é o bloqueio otimista do agregado
2. `Put`/`Update`/`Delete` nos itens de pasta afetados
3. `Put` do guard de slug com `attribute_not_exists(PK)`, que põe I1 no banco e não só em memória
4. `Put` dos eventos de domínio na **outbox**, na mesma transação

### 10.2 Forma B: mutação de nota (agregado `Note`)

Criar, editar, retitular, reordenar, mover, apagar.

1. `Put`/`Update`/`Delete` do item `NOTE` com `ConditionExpression: version = :expected`, em que o lock é do próprio item
2. `ConditionCheck` com `attribute_exists` no item `FOLDER#{f}` de destino e, no move entre vaults, também no `META` do vault de destino
3. `Put`/`Delete` do guard `NSLUG` quando o slug entra ou sai do vault
4. `Put` do evento na outbox

> **Nenhuma transação de nota escreve no item `META`** (PE8). É esta regra, e não a separação dos agregados por si só, que mantém o caminho quente livre de contenção. `META` é um item único: um agente gravando cinquenta notas em sequência o transformaria no gargalo de todo o vault, e o retry só transformaria a contenção em latência. O `ConditionCheck` dá a mesma garantia que interessa, *"a pasta existia no instante da escrita"*, sem escrever nela, e o item `FOLDER` só é escrito quando a pasta é renomeada ou movida, que é evento raro.

Conflito gera `TransactionCanceledException`, o repositório traduz para `ConcurrencyError` e o caso de uso repete, até 3 vezes. **O domínio nunca vê exceção da AWS** (PE7).

### 10.3 Contadores

`FSTAT` e `FSTAT#{folderId}` são mantidos pelo relay da outbox, **fora** da transação do usuário. Para não contar duas vezes quando o stream reprocessa, o incremento vai numa transação com um item de dedup:

```
TransactWriteItems
  Put     SK = SEEN#{eventUlid}    ConditionExpression: attribute_not_exists(SK)   (TTL 7d)
  Update  SK = FSTAT#{folderId}    ADD noteCount :delta
```

Contagem eventualmente consistente é aceitável de propósito: o número orienta o agente e a UI, e não participa de invariante nenhuma.

### 10.4 Outbox

DynamoDB Streams → Lambda relay → EventBridge. Garante que mudança de estado e publicação sejam atômicas, porque sem isso "gravei mas não publiquei" acontece e é silencioso. Num sistema cuja trilha de auditoria vive de eventos, esse silêncio seria um buraco no registro.

### 10.5 Ordem de escrita com o S3

Conteúdo primeiro, ponteiro depois:

```
1. PutObject em s/{subscriptionId}/c/{contentId}.md     → devolve versionId
2. monta o ContentRef                             → { contentId, versionId, sha256, bytes }
3. TransactWriteItems                             → Update do item com o novo …Ref
                                                  + Put do evento na outbox, com o ContentRef dentro
```

**A ordem decide qual falha se aceita.** Se o passo 3 falhar, sobra no S3 um blob que ninguém referencia: invisível, inofensivo, recolhido pelo job semanal de órfãos. A ordem inversa produziria um ponteiro para conteúdo inexistente, erro que o usuário vê, no meio do caminho quente.

O `ContentRef` viaja **dentro do evento, na mesma transação**. Sem isso, o `svc-audit` registraria "a nota mudou" sem poder mostrar para quê, e o `svc-discovery` re-indexaria "a versão atual" em vez da versão que disparou o evento, que sob concorrência não é a mesma coisa.

Nada disso acontece no agregado: quem fala com o `ContentStore` é o caso de uso, que recebe o `ContentRef` pronto e o entrega ao domínio. O agregado nunca soube que existe S3.

---

## 11. Discovery: grafo, busca e facetas

Três projeções sobre os mesmos eventos. Todas **derivadas** (PE5): apagar e reconstruir do zero é operação suportada, e é o plano de recuperação das três. Regras de negócio em `software-vision.md` §10.

### 11.1 Grafo de links

`LinkExtractor` (§6.6) roda a cada `NoteCreated` e `NoteUpdated`. O alvo é reduzido ao **basename sem extensão** e normalizado para `Slug`; a resolução acontece no escopo do vault (RN-DSC-001 a RN-DSC-006).

**Tabela `mv-discovery`:**

| Item | PK | SK |
|---|---|---|
| Aresta de saída | `S#{s}#VAULT#{v}` | `OUT#{fromNoteId}#{toNoteId}` |
| Aresta de entrada (backlink) | `S#{s}#VAULT#{v}` | `IN#{toNoteId}#{fromNoteId}` |
| Link pendente | `S#{s}#VAULT#{v}` | `PENDING#{slug}#{fromNoteId}` |

Aresta gravada nas duas direções: backlink vira um `Query`, não uma varredura. Travessia em BFS com profundidade máxima 3 e teto de 200 nós, deduplicando ciclos (RN-DSC-007).

`NoteMoved` entre pastas **não toca no grafo**, porque aresta é `noteId → noteId` e pasta não participa. `NoteMoved` entre vaults poda as arestas da nota no vault de origem e re-resolve as de saída contra os slugs do destino.

### 11.2 Busca

A busca é **literal sobre o texto do vault**, respondida a partir de um item por nota na `mv-discovery`:

| Item | PK | SK |
|---|---|---|
| Retrato pesquisável | `S#{s}#VAULT#{v}` | `TEXT#{noteId}` |

O item guarda título, pasta, headings, as facetas e o corpo **duas vezes**: normalizado para casar e como foi escrito para o trecho. A normalização é feita caractere a caractere, e cada caractere contribui com exatamente o tamanho que ocupava, de modo que uma posição no texto normalizado é a mesma posição no original. É isso que permite recortar o trecho do texto que a pessoa escreveu: um `NFD` sobre a string inteira desloca todos os deslocamentos depois do primeiro acento, e o leitor receberia uma passagem cortada alguns caracteres fora do lugar, ou prosa rebaixada que ninguém digitou.

**A varredura é do vault inteiro, e isso é escolha, não atalho.** O teto é de 2.000 notas por vault (`software-vision.md` §14), cerca de 8 MB, e nesse tamanho varrer custa 1.061 unidades de leitura por consulta, algo como US$ 0,00027. Um índice invertido seria mais barato por consulta e muito mais caro de manter correto: cada escrita teria que atualizar as postings de cada termo, e a diferença em dinheiro, no teto declarado, é de centavos por mês. A comparação com o índice vetorial que saiu é o argumento inteiro:

| | Bytes por vault no teto | Amplificação sobre o Markdown | Leitura por consulta |
|---|---|---|---|
| `CHUNK#` com vetor (removido) | 82,8 MB | 10,6× | 10.597 RRU |
| `TEXT#` com o corpo | 8,3 MB | 1,06× | 1.061 RRU |

**O que a varredura não pode é parar cedo.** `scanVault` percorre todas as páginas do `Query`, e há um teste com nove páginas falsas que prova isso. Não é detalhe de otimização: foi exatamente um `Query` que parava na primeira página de 1 MB que quebrou a busca anterior, e 8 MB são oito páginas.

**A linguagem de consulta** (`SearchQuery.ts`) é domínio puro, sem AWS e sem I/O, e por isso testada inteira sem infraestrutura. Ela conhece quatro campos por nome, `title`, `folder`, `content` e `section`, e resolve **qualquer outro prefixo como faceta**. Nenhuma lista de nomes de faceta existe no código, o que é a mesma decisão do `FacetExtractor` (§11.3) levada até a consulta: o vocabulário é do Guidance, então um vault que passe a escrever `norma: federal` ganha `norma:federal` como filtro no mesmo dia.

**O que havia antes, e por que saiu.** Até a 0.1.0 o Discovery mantinha um índice vetorial: as notas eram cortadas em trechos por heading, cada trecho recebia um prefixo de contexto (`vault › pasta › descrição da pasta › título`), ia ao Bedrock Titan Text Embeddings V2 em 1024 dimensões e o vetor era gravado como lista de `Number` na própria tabela `mv-discovery`, em itens `CHUNK#{noteId}#{i}`.

Três medidas tomadas no ambiente real condenaram o desenho:

| Medida | Valor | Consequência |
|---|---|---|
| Item de um chunk | 14.473 bytes, dos quais 14.175 são o vetor | 1 GB de Markdown vira 10,6 GB de itens |
| Leitura por consulta | O vault inteiro, sem `ProjectionExpression` | Custo por pergunta cresce com o tamanho do vault |
| Página do `Query` | 1 MB, e o método não paginava | A busca enxergava 65 chunks e ignorava o resto em silêncio |

O terceiro item é o decisivo: a busca **parecia** funcionar porque o corte de 1 MB a mantinha rápida, enquanto varria menos de 0,01% de um vault grande. Um índice que mente em silêncio é pior que a ausência dele, que é declarada.

**O que continua ausente é a busca por significado**, a que acha a nota que fala do assunto com outras palavras. Essa não volta por varredura: exige um índice vetorial com recuperação de verdade, e o candidato é S3 Vectors, que guarda vetor a US$ 0,06 por GB ao mês e não lê tudo a cada consulta. A diferença em relação ao que saiu é que ela voltará como acréscimo a uma busca que funciona, e não como a única busca que existe.

**Isolamento:** qualquer índice que substitua este é **por assinatura** (RN-SUB-015), nunca um índice global filtrado por metadado. Filtro de metadado é controle de acesso por convenção; índice separado é fronteira física.

### 11.3 Facetas de curadoria

Terceira projeção, a que serve o painel de curadoria. Regras de negócio em `software-vision.md` §10.3.

`FacetExtractor` roda a cada `NoteCreated`, `NoteUpdated`, `NoteDeleted` e `NoteRestored`: carrega o blob pelo `ContentRef` do evento, lê **apenas o bloco de frontmatter** e classifica cada par chave-valor pela **forma do valor**: data, booleano, valor curto enumerável e lista de valores curtos são agregáveis; texto livre é descartado (RN-DSC-020). Não há lista de chaves no código nem configuração por vault: o vocabulário é do Guidance, e `maturity` e `reviewed`, as facetas padrão do produto, são para o extrator atributos como quaisquer outros. É o segundo leitor de conteúdo sancionado, ao lado do `LinkExtractor`, e como ele vive fora do core (PP4).

**Consumo:** regra do EventBridge → SQS → Lambda, com DLQ. A fila absorve rajada de ingestão em lote, e retry ou falha do projetor nunca tocam o caminho quente da escrita.

**Tabela `mv-discovery`:**

| Item | PK | SK | Atributos |
|---|---|---|---|
| Retrato de facetas da nota | `S#{s}#VAULT#{v}` | `FACET#{noteId}` | mapa `{atributo: valor(es)}` dos agregáveis, version |
| Contador agregado | `S#{s}#VAULT#{v}` | `STAT#{facet}#{value}` | count |
| Estado do atributo | `S#{s}#VAULT#{v}` | `FDEF#{facet}` | tipo inferido, distinctCount, `discarded?` |
| Dedup de evento | `S#{s}#VAULT#{v}` | `SEEN#{eventUlid}` | TTL 7d |

**O retrato por nota é o que torna o delta exato.** Atualização e exclusão precisam decrementar o valor antigo ("a nota era `growing`, virou `evergreen`"), e o valor antigo não está no evento: está no retrato. O projetor lê `FACET#{noteId}`, computa o delta e aplica tudo numa única transação, no mesmo padrão dos contadores de pasta (§10.3): `Put` do `SEEN#{eventUlid}` com `attribute_not_exists`, `Put` do retrato novo e `ADD count :delta` nos contadores afetados. Reprocessamento da fila é um no-op pelo dedup; evento fora de ordem perde para o `version` maior já retratado.

Um item de contador **por valor de faceta**, e não um item único de estatísticas por vault: cinquenta notas gravadas em paralelo incrementam contadores diferentes, e o item único viraria o mesmo gargalo que a regra do `META` (PE8) existe para evitar.

**O teto de cardinalidade é o detector de texto livre** (RN-DSC-024). `FDEF#{facet}` acompanha quantos valores distintos o atributo já produziu no vault; ao ultrapassar o teto, o projetor marca o atributo como `discarded`, apaga seus itens `STAT#` e passa a ignorá-lo. É assim que `title` e `source` nunca viram estatística, sem nenhuma lista de exclusão no código: um atributo cujo valor é único por nota se denuncia sozinho pela cardinalidade.

**Montar o painel é um `Query`** com prefixo `STAT#` por vault, sem tocar em nota nenhuma. Reconstrução (PE5): apagar os itens `FACET#` e `STAT#` do vault e reprocessar as notas.

### 11.4 Portas

```typescript
export interface LinkGraph {
  replaceOutgoing(note: NoteId, links: LinkTarget[]): Promise<void>;
  dependencyTree(root: NoteId, depth: Depth): Promise<GraphNode>;
  backlinks(note: NoteId): Promise<NoteRef[]>;
  broken(vault: VaultId): Promise<BrokenLink[]>;
  orphans(vault: VaultId): Promise<NoteRef[]>;
}

export interface ContentIndex {
  replaceNote(vault: VaultId, note: IndexedNote): Promise<void>;
  removeNote(vault: VaultId, note: NoteId): Promise<void>;
  /** Every page. A partial scan that claims to be whole is worse than none. */
  scanVault(vault: VaultId): Promise<IndexedNote[]>;
}

export interface FacetExtractor { extract(frontmatter: string): FacetSnapshot; }

export interface FacetIndex {
  replaceFacets(note: NoteId, facets: FacetSnapshot | null): Promise<void>; // null: nota apagada
  vaultFacetStats(vault: VaultId): Promise<FacetStats>;
}
```

---

## 12. Proveniência e histórico

Regras de negócio em `software-vision.md` §11.2.

### 12.1 `Authorship`

```typescript
export class Authorship {                    // VO imutável
  constructor(
    readonly user: UserId,                   // sempre um humano: o dono do token
    readonly agent: AgentIdentity | null,    // null = escrita pela UI
    readonly at: Instant,
  ) {}
}

export class AgentIdentity {
  constructor(readonly clientId: OAuthClientId, readonly clientName: string) {}
}
```

Quem preenche é o adaptador de entrada: `McpToolAdapter` resolve o agente a partir do token, e o adaptador HTTP da UI o deixa nulo. O domínio recebe `Authorship` pronto e obrigatório (PE6).

### 12.2 `svc-audit`

Consumidor de **todos** os eventos do bus, de todos os serviços.

| Item | PK | SK | Atributos |
|---|---|---|---|
| Audit Event | `S#{s}#{subject}#{subjectId}` | `AT#{timestamp}#{eventUlid}` | type, authorship, contentRef, payload |

com `subject ∈ {SUBSCRIPTION, MEMBER, VAULT, FOLDER, NOTE}`. Um `Query` por `PK` devolve a linha do tempo completa de qualquer objeto, em ordem cronológica, sem varredura.

A chave é **por sujeito, não por vault**, e isso não é detalhe: é o que faz a linha do tempo de uma nota sobreviver a ela mudar de pasta e de vault, desde que o `NoteId` seja preservado. É a razão de `moveTo` existir como comando em vez de ser implementado como delete mais create (§6.2).

**A imutabilidade não é convenção (PE4): a role do Lambda tem `Deny` explícito em `UpdateItem` e `DeleteItem` na tabela.** Não existe caminho, nem por bug nem por operador, que reescreva o passado. É a diferença entre "não alteramos o log" e "não conseguimos alterar o log", e só a segunda serve diante de um regulador.

### 12.3 Revision e reconstrução histórica

O bucket é versionado, então cada gravação num Content Slot produz um `versionId` imutável. **O evento carrega o `ContentRef` completo**, e é o detalhe que liga *"aconteceu algo"* a *"o conteúdo era este"*.

Reconstruir a nota numa data:

1. no log, o último evento daquela nota com `timestamp ≤ data`
2. `GET` no S3 em `s/{subscriptionId}/c/{contentId}.md` com o `versionId` daquele evento

Nenhuma consulta ao Knowledge é necessária: **o presente vive no `mv-knowledge`, o passado vive no `mv-audit`**, e o evento traz o par `(contentId, versionId)` que basta para buscar o byte. Como a chave é opaca, mover ou renomear a nota depois não afeta a reconstrução: o slot é o mesmo, e o histórico de revisões permanece num único objeto do S3 em vez de espalhado por objetos criados a cada move.

Para assinaturas com exigência formal de retenção, **S3 Object Lock em modo compliance** trava as versões contra remoção pelo prazo configurado, inclusive contra a conta raiz (RN-AUD-008).

### 12.4 Apagar não é destruir

**`NoteDeleted` é soft delete.** O item `NOTE` ganha `deletedAt` e `deletedBy`, e **perde os atributos de chave do `GSI2`**: como o índice é esparso (§9.3), a nota some das listagens sem uma linha de filtro em lugar nenhum. O `bodyRef` fica intacto, então `read_note(asOf)` e `note_history` continuam respondendo por `NoteId`. O guard `NSLUG` é apagado na mesma transação, devolvendo o slug ao vault (RN-KNW-030). Restaurar é devolver os atributos de índice, o que sai de graça e vira `NoteRestored`.

**Destruir conteúdo é ato administrativo, nunca operação de domínio.** Por isso `purge` não existe na porta `ContentStore` (§7.1). O expurgo vive num caso de uso próprio, exige o `OWNER` da assinatura, motivo obrigatório e emite evento:

```typescript
// application/admin/EraseContent.ts — fora do Knowledge, de propósito
interface ContentEraser {
  erase(slot: ContentId, reason: ErasureReason, by: Authorship): Promise<void>;
}
// → ContentErased { contentId, reason, by, at }
```

**Object Lock e expurgo são incompatíveis, por desenho** (RN-AUD-009). Com retenção em modo compliance, `erase` falha, e falhar é o comportamento correto.

---

## 13. MCP server

Endpoint: `https://mcp.memorysmith.app/mcp` (Streamable HTTP, OAuth 2.1). Catálogo de tools e formato do Vault Context em `software-vision.md` §9, porque **o catálogo é contrato público e vive lá, não aqui**.

### 13.1 `svc-agent` como camada anticorrupção

`McpToolAdapter` traduz tool call em comando de caso de uso e volta, e resolve o `Authorship` a partir do token. Nenhum vocabulário de MCP entra no core (RN-AGT-008), e trocar de protocolo amanhã é trocar um adaptador.

### 13.2 Autenticação

MCP remoto exige OAuth 2.1 com *Protected Resource Metadata* (`knowledge-base.md` §3.4). **Cognito como Authorization Server; `svc-agent` como Resource Server e como proxy de registro de cliente (§13.3).** O `subscriptionId` entra no token pelo trigger de *pre-token-generation* (§8.3), e o `client_id` do conector vira `AgentIdentity` (§12.1).

### 13.3 Registro de cliente: proxy CIMD na frente do Cognito

O Cognito não implementa nenhum mecanismo de registro automático de cliente, nem DCR nem CIMD (`knowledge-base.md` §3.4). A especificação MCP atual depreciou o DCR e recomenda CIMD, e os clientes de agente relevantes suportam CIMD nas superfícies desktop, web e CLI. A decisão: **o `svc-agent` implementa CIMD, atuando como proxy de autorização na frente do Cognito.** O Cognito continua emitindo todos os tokens; o proxy resolve apenas o registro do cliente. Nenhum componente novo de infraestrutura: o proxy é código dentro do Lambda do `svc-agent`, que já é o Resource Server.

**O mecanismo, ponta a ponta:**

1. **Descoberta.** Requisição não autenticada ao endpoint MCP devolve `401` com `WWW-Authenticate: Bearer resource_metadata="https://mcp.memorysmith.app/.well-known/oauth-protected-resource"`. No documento de PRM, o campo `resource` é exatamente a URL do endpoint MCP como o usuário a digita, e `authorization_servers` aponta para o issuer do próprio `svc-agent`, não para o Cognito.
2. **Metadados de authorization server.** O `svc-agent` serve o documento RFC 8414 do seu issuer anunciando `client_id_metadata_document_supported: true` e `"none"` em `token_endpoint_auth_methods_supported`, ambos obrigatórios para o cliente escolher CIMD, mais `code_challenge_methods_supported: ["S256"]`, com `authorization_endpoint` e `token_endpoint` apontando para o próprio proxy.
3. **Autorização.** Ao receber um `client_id` em forma de URL, o proxy busca o documento de metadados do cliente e o valida antes de qualquer redirecionamento: HTTPS obrigatório, bloqueio de endereço privado na resolução (anti-SSRF), teto de tamanho e timeout na busca, `client_id` interno ao documento idêntico à URL, e `redirect_uri` da requisição presente na lista do documento. Validado, encaminha o navegador ao endpoint de autorização do Cognito usando o único app client pré-registrado do proxy, preservando o PKCE do cliente e correlacionando as duas pernas por `state`. Os `redirect_uri` aceitos incluem o callback dos clientes hospedados e loopback (`localhost` e `127.0.0.1`) com a porta ignorada na comparação, conforme a RFC 8252.
4. **Token.** O endpoint de token do proxy troca o código com o Cognito e devolve o JWT do Cognito **inalterado**: o proxy jamais emite ou modifica token. Aceita `application/x-www-form-urlencoded`, repassa o refresh com rotação de refresh token, e as claims `subscription_id` e `subscription_status` continuam entrando pelo trigger de §8.5. O `client_id` CIMD, a URL, é o que vira `AgentIdentity` (§12.1).
5. **DCR deliberadamente ausente.** Os metadados não expõem `registration_endpoint`. Além de depreciado, o DCR criaria um app client no user pool a cada conexão nova, acumulando lixo de registro e consumindo quota. Para um cliente que não fale CIMD, o fallback é o pré-registro: informar um `client_id` à mão na configuração do conector, que os clientes suportam por especificação.
6. **Restrições operacionais que viram teste.** Os clientes esperam resposta dos endpoints de descoberta, autorização e token em até 10 segundos, então o caminho OAuth do Lambda precisa de p95 folgado sob esse teto, cold start incluído. Os endpoints de descoberta precisam ser alcançáveis a partir do egress dos provedores de cliente de agente, sem WAF os bloqueando.

**Alavanca de remoção.** O proxy existe porque o Cognito não fala CIMD. Se um dia falar, o PRM passa a apontar para o issuer do Cognito e o proxy é removido sem migração: o `client_id` CIMD é uma URL hospedada pelo próprio cliente, portável entre authorization servers por construção, então não há estado de registro no nosso lado para carregar. Até lá, o proxy é tratado como componente permanente, com a mesma régua de segurança do resto da borda.

**O spike da entrega 1 (§25) valida este desenho, e continua vindo antes de tudo:** um proxy mínimo com um conector CIMD funcionando de ponta a ponta num cliente desktop e num cliente web, cumprindo os itens 1 a 6. Com a decisão tomada, o risco muda de natureza: deixa de ser escolha de rumo e vira conformidade de integração. A tese, porém, continua dependendo dele (`software-vision.md` §1.4): se o atrito persistir mesmo com o proxy, o plano B é um provedor de identidade com CIMD nativo (WorkOS AuthKit, Auth0), troca contida na stack de identidade e no proxy, sem tocar no domínio.

**Referências normativas e de integração:**

- Model Context Protocol, registro de cliente: <https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration>
- Anthropic, autenticação de conectores: <https://claude.com/docs/connectors/building/authentication>
- OAuth Client ID Metadata Document, draft IETF: <https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/>
- RFC 9728 (Protected Resource Metadata) · RFC 8414 (Authorization Server Metadata) · RFC 8252 (apps nativos e loopback) · RFC 7636 (PKCE)

### 13.4 Idempotência e concorrência

Ambas resolvidas sem mecanismo novo:

- **Idempotência.** `NSLUG#{slug}` é único no vault (§9.3), então a segunda chamada de `create_note` falha no `attribute_not_exists` e o adaptador devolve `ALREADY_EXISTS` com o `noteId` existente no `details` (RN-AGT-004). O servidor nunca gera sufixo automático.
- **Concorrência.** `update_note` exige `baseRevision`, e divergência devolve `CONFLICT` com o conteúdo atual anexado (RN-AGT-005).

---

## 14. API interna e autorização

### 14.1 Rotas

Consumidas pela UI; **o contrato público é o MCP**.

```
svc-access       GET  /session/subscriptions · POST /session/subscription  { subscriptionId }
                 POST /subscriptions      { type?, quota? }  (pending_approval)
                 POST /subscriptions/:s/ownership          { toUserId }
                 GET  /members · POST /members             { email, role }
                 PATCH /members/:u  { role } · DELETE /members/:u
                 POST /invites/:token/accept · GET /authz  (Lambda Authorizer)
svc-access       GET  /platform/subscriptions?status=      ─┐  sessão de plataforma:
 (plataforma)    POST /platform/subscriptions/:s/approve    ├─ sem claim subscription_id,
                 POST /platform/subscriptions/:s/reject     │  lê só pelo GSI2 (§8.3, §8.4)
                 POST /platform/subscriptions/:s/suspend    │
                 PUT  /platform/subscriptions/:s/status     │  ato administrativo: define o
                 PATCH /platform/subscriptions/:s/plan     ─┘  status sem a máquina de
                                                               transição (RN-SUB-018)
svc-knowledge    POST /vaults · GET /vaults/:v · PUT /vaults/:v/guidance
                 POST /vaults/:v/folders · PATCH /vaults/:v/folders/:f
                 POST /vaults/:v/folders/:f/reorder   { afterFolderId | null }
                 PUT  /vaults/:v/folders/:f/template
                 POST|GET|PUT|DELETE /vaults/:v/notes[/:n]
                 POST /vaults/:v/notes/:n/reorder   { afterNoteId | null }
                 POST /vaults/:v/notes/:n/restore
                 POST /vaults/:v/notes/:n/move   { toVaultId?, toFolderId, onSlugConflict }
                 PUT|DELETE /vaults/:v/limits/:userId   { limit: VIEWER }   (§9.3)
svc-discovery    GET  /vaults/:v/graph   (grafo inteiro do vault, arestas por índice)
                 GET  /vaults/:v/notes/:n/graph?depth= · GET /vaults/:v/notes/:n/backlinks
                 GET  /vaults/:v/health   (links quebrados, órfãs)
                 POST /vaults/:v/search   { query, mode: lexical | semantic }
svc-audit        GET  /notes/:n/history · GET /notes/:n/revisions/:versionId
                 GET  /vaults/:v/activity?from=&to=
svc-portability  POST /vaults/:v/exports · GET /exports/:id   → URL pré-assinada
```

**Nenhuma rota recebe `subscriptionId`**, que vem sempre do token (§8.1).

Roteamento por path num CloudFront único (`api.memorysmith.app/knowledge/*` e assim por diante). Chamadas entre serviços via API Gateway com **IAM auth**, nunca por rede aberta.

### 14.2 Autorização em dois estágios

Deixar isso implícito é como nascem os furos de authz. Cada estágio tem dono explícito:

1. **Authorizer (`svc-access`).** Valida o JWT do Cognito, confirma que a assinatura ativa está em `trial` ou `active` (RN-SUB-007), resolve a titularidade (`isOwner`) e o papel do usuário na assinatura, e injeta tudo no contexto da requisição (cache 5 min). **Não sabe o que é um vault**, nem poderia: quem guarda o teto por vault é o Knowledge.
2. **Serviço dono do recurso.** O `AuthorizationPolicy`, serviço de domínio e não porta de infra (§6.6), decide localmente, sem nenhuma chamada de rede.

**A decisão do estágio 2, em uma expressão.** O papel efetivo é o menor entre o papel na assinatura e o teto do vault, e a titularidade passa por cima dos dois:

```typescript
// domain/access/AuthorizationPolicy.ts — sem I/O, sem SDK
effectiveRole(ctx: RequestContext, vault: Vault): Role {
  if (ctx.isOwner) return Role.OWNER;                     // titular alcança tudo (RN-ACC-013)
  if (!ctx.role.canRead()) return Role.NONE;             // EDITOR | VIEWER | none
  return Role.min(ctx.role, vault.limitFor(ctx.user));   // o teto só rebaixa (RN-ACC-011)
}
```

Os três insumos chegam sem custo extra: `isOwner` e o papel vêm do contexto injetado pelo authorizer, e os tetos vêm do **mesmo `Query`** que já carregou o vault (§9.3). Nenhuma consulta adicional entra no caminho quente por causa da autorização.

**Regra fixa, sem exceção:** todo caso de uso do Knowledge carrega o vault e chama `policy.require(action, vault)` **antes de qualquer outra coisa**. E **recurso proibido devolve o mesmo `404` que recurso inexistente** (RN-SUB-004), porque `403` confirmaria a existência de um vault que o requisitante não pode ver.

> **Uma exceção deliberada ao `404`:** escrita recusada por teto de vault devolve `FORBIDDEN` de verdade, não `404`. O membro **já sabe** que o vault existe, porque o vê na lista (RN-ACC-012: o teto nunca esconde). Devolver `404` ali não protegeria informação nenhuma e produziria a pior experiência possível: um vault que aparece na tela e some ao ser escrito. A regra do `404` protege existência; onde não há existência a proteger, ela não se aplica.

**Três relógios, todos declarados:**

| Mudança | Tempo até surtir efeito | Por quê |
|---|---|---|
| Papel na assinatura, teto de vault, remoção de membro | até 5 min | cache do authorizer (RN-ACC-016) |
| Status da assinatura (suspensão) | vida do token | a claim `subscription_status` envelhece com ele (§8.5) |
| Titularidade transferida | até 5 min | mesmo cache |

São aceitáveis e estão declarados. Se uma assinatura exigir revogação imediata, o ponto de extensão é uma denylist curta consultada pelo authorizer, e ela cobriria os três casos de uma vez.

---

## 15. Taxonomia de erros

Uma taxonomia só, no `memorysmith-backend/packages/kernel`, definida **antes** da primeira linha de caso de uso. Sem isso, cada serviço inventa a sua e a borda vira tradução ad hoc.

```typescript
type ErrorCode =
  | 'VALIDATION' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT'
  | 'PRECONDITION_FAILED' | 'LIMIT_EXCEEDED' | 'INTERNAL';

export class DomainError {
  constructor(readonly code: ErrorCode, readonly message: string, readonly details?: unknown) {}
}
```

| Código | HTTP | Quando |
|---|---|---|
| `VALIDATION` | 400 | VO recusou o valor no construtor |
| `NOT_FOUND` | 404 | não existe |
| `FORBIDDEN` | **404** | existe e o requisitante não pode ver, já que `403` vazaria a existência |
| `CONFLICT` | 409 | lock otimista, slug já usado, `baseRevision` divergente |
| `PRECONDITION_FAILED` | 412 | política obrigatória ausente (`RemovalPolicy`, `SlugConflictPolicy`) |
| `LIMIT_EXCEEDED` | 413 / 429 | nota acima do teto, rate limit da assinatura |
| `INTERNAL` | 500 | o resto, e só o resto |

O domínio devolve `Result<T, DomainError>`; **exceção existe só na borda**. O adaptador traduz `TransactionCanceledException` em `CONFLICT`, e `ConditionalCheckFailed` no guard de slug em `CONFLICT` com o `noteId` existente no `details`. No MCP, todo erro vira `isError` com texto acionável, e o de argumento faltante devolve o template junto (RN-AGT-003).

---

## 16. Export

`svc-portability` consome os eventos, monta o zip e devolve URL pré-assinada. Formato da árvore e regras em `software-vision.md` §12.

**Implementação:** a árvore materializada é construída a partir do agregado `Vault` e das notas; o conteúdo vem do `ContentStore` pelos `ContentRef` correntes. O prefixo numérico é derivado da ordem de `Position` no momento do export, e não é armazenado.

**É aqui que nomes reservados voltam a existir.** No storage não há nome nenhum (§9.2); na árvore materializada, `GUIDANCE.md` e `TEMPLATE.md` são ocupados pelo guidance e pelo template, e `STRUCTURE.md` pela árvore anotada, escrita uma única vez na raiz. A descrição de uma pasta é atributo do item `FOLDER` e nunca alcançou o `ContentStore`, então ela viaja nesse documento e não em um arquivo por pasta. Uma nota cujo slug colida com um dos três nomes é exportada com sufixo, e os links para ela são reescritos junto (RN-PRT-005). É a única concessão do export, e ela pertence à borda, não ao modelo.

---

## 17. Infraestrutura

| Camada | Escolha |
|---|---|
| Compute | **Um Lambda por serviço** (Node.js 22, ARM64), roteamento interno com Hono |
| API | API Gateway HTTP API por serviço, atrás de um CloudFront |
| Dados | Uma tabela DynamoDB por serviço (on-demand, PITR), bucket S3 versionado com chaves opacas planas (Object Lock opcional) e bucket S3 Vectors |
| Eventos | EventBridge (bus `mv-events`) e DynamoDB Streams para a outbox |
| Identidade | Cognito user pool com pre-token-generation trigger (claim `subscription_id`) |
| DNS | Route 53: hosted zone de `memorysmith.app` e todos os registros criados pelo CDK no `network.stack` |
| Front-end | React + Vite (SPA) em S3 + CloudFront |
| IaC | AWS CDK (TypeScript), um stack por serviço mais um de rede e domínio |
| Observabilidade | Powertools for AWS Lambda; `subscriptionId` em **toda** linha de log e como dimensão de métrica |

> **Um Lambda por serviço, não um por rota:** menos cold starts, um composition root por deployable, e a fronteira que importa (o bounded context) continua sendo a unidade de deploy.

**Domínios e DNS.** O domínio `memorysmith.app` está registrado. A partir dele, tudo é declarado pelo CDK no `network.stack`: a hosted zone pública no Route 53, os certificados ACM validados por DNS na própria zona (emissão e renovação automáticas) e os registros de cada superfície. Nenhum registro é criado à mão no console.

| Host | Serve | Stack que cria o registro |
|---|---|---|
| `memorysmith.app` | A SPA (S3 + CloudFront) | `frontend-hosting.stack` |
| `www.memorysmith.app` | Redirect permanente para o apex | `frontend-hosting.stack` |
| `api.memorysmith.app` | API interna, roteada por path no CloudFront (§14.1) | `network.stack` |
| `mcp.memorysmith.app` | MCP server e endpoints OAuth do proxy CIMD (§13) | `agent.stack` |

Dois cuidados que pertencem à instrução, não à execução:

- **Certificado de CloudFront vive em `us-east-1`.** É exigência do CloudFront, não escolha. O CDK resolve com um stack de certificado naquela região e referência cross-region; o restante da infra permanece na região principal.
- **Se o registro do domínio estiver fora do Route 53, a delegação é um ato manual único:** apontar os name servers no registrador para os NS da hosted zone criada pelo CDK. É a única escrita de DNS feita fora do código, e acontece uma vez.

**Certificados.** Todo TLS do produto usa certificado público X.509 emitido pelo ACM, e nada além disso:

- **Emissão pelo CDK, validação por DNS na própria hosted zone.** O construct de certificado cria os registros de validação automaticamente; nenhum desafio manual, nenhum e-mail de aprovação.
- **Renovação automática e transparente.** O ACM renova antes do vencimento sem intervenção. A validade máxima de certificado público caiu para 198 dias por mandato do CA/Browser Forum; isso não muda nada operacionalmente aqui, porque a renovação é gerida, e é mais uma razão para jamais administrar certificado à mão.
- **Não exportáveis, de propósito.** A chave privada nunca sai da AWS; o certificado só se associa a CloudFront e API Gateway. Se algum dia um certificado precisar sair (outro provedor, um appliance), essa é uma decisão nova, com custo próprio, e não um default a mudar em silêncio.
- **Um certificado por distribuição, com SANs cobrindo seus hosts:** o da distribuição do frontend cobre `memorysmith.app` e `www`; o da distribuição de API cobre `api`; o do MCP cobre `mcp`. Certificados de distribuição CloudFront nascem no stack de `us-east-1`; certificados de custom domain de API Gateway nascem na região principal.
- **Sem Private CA.** Não há caso de uso para autoridade certificadora própria no desenho, e o custo fixo dela (US$ 400 por mês) não compra nada aqui. A comunicação interna entre serviços é autenticada por IAM (§14.1), não por mTLS.

**Custo de DNS e certificados**, aos preços publicados pela AWS ([Route 53](https://aws.amazon.com/route53/pricing/), [ACM](https://aws.amazon.com/certificate-manager/pricing/)):

| Item | Preço | No nosso desenho |
|---|---|---|
| Hosted zone | US$ 0,50 por zona/mês (até 25 zonas) | 1 zona |
| Consultas alias para recursos AWS (CloudFront, S3) | Gratuitas | Todos os nossos registros são alias; custo de consulta efetivamente zero |
| Consultas padrão | US$ 0,40 por milhão | Só se surgirem registros não-alias |
| Certificado público ACM não exportável | Gratuito, emissão e renovação | Todos os nossos certificados |
| Certificado público exportável | US$ 7 por FQDN, US$ 79 por wildcard, na emissão e em cada renovação | Não usamos |
| AWS Private CA | US$ 400 por mês (US$ 50 no modo short-lived) | Não usamos |

O custo fixo de toda a camada de DNS e TLS é, portanto, a hosted zone: cerca de US$ 0,50 por mês. O registro e a renovação anual do domínio são cobrados pelo registrador onde `memorysmith.app` foi comprado e ficam fora da conta AWS enquanto o domínio não for transferido para o Route 53.

**Jobs periódicos:**

| Job | Frequência | O que faz |
|---|---|---|
| Coleta de órfãos no S3 | Semanal | Recolhe blobs sem referência, nascidos de falha entre os passos 1 e 3 de §10.5 |
| Rebalanceamento de `Position` | Sob demanda | Redistribui chaves fracionárias que passaram de 12 caracteres (§6.4) |

**Alarmes obrigatórios por Lambda:** taxa de erro, duração p99, throttles e profundidade da fila de dead-letter do relay da outbox.

---

## 18. Requisitos não-funcionais

Números iniciais, para virarem teste e não folclore. A tese do produto é "sem atrito", e sem número isso não é verificável. Limites de produto (tamanho de nota, tetos por vault) estão em `software-vision.md` §14.

| | Alvo |
|---|---|
| `get_vault_context` p95 | ≤ 400 ms quente · ≤ 1,5 s frio |
| `create_note` / `update_note` p95 | ≤ 600 ms (sem contar a projeção, que é assíncrona) |
| `read_note` p95 | ≤ 300 ms quente |
| Atraso de reindexação após escrita | ≤ 30 s p95 |
| Retenção da outbox | TTL 7 dias |
| Retenção do item de dedup `SEEN#` | TTL 7 dias |

---

## 19. Estratégia de testes

| Camada | Como |
|---|---|
| Domínio | Unit puro, **sem I/O e sem mock de framework**. Se precisar de mock de SDK, o hexágono vazou |
| Casos de uso | Com adaptadores `InMemory` |
| Adaptadores | Contra DynamoDB Local e MinIO |
| Contratos de evento | Schemas Zod validados nos dois lados (produtor e consumidor) |
| Ponta a ponta | Por fatia vertical |

**Três testes que não são opcionais e existem desde a primeira entrega que os torna possíveis:**

- **Teste de isolamento por serviço:** duas assinaturas, a de A tentando ler a de B, esperando `404` e não `403`.
- **Teste da sessão de plataforma:** um token de `PLATFORM_ADMIN`, que não carrega `subscription_id`, contra qualquer rota do Knowledge deve falhar por **impossibilidade de montar a chave**, não por verificação de papel (RN-SUB-016).
- **Teste de imutabilidade do audit:** tentativa de `UpdateItem` no log deve falhar **por IAM**, não por código. Um teste que passa porque a aplicação não tem o método não prova nada.

---

## 20. CI/CD

### 20.1 Integração contínua

Roda em todo pull request e em todo push na `main`, definida em `.github/workflows/ci.yml`. São cinco jobs, todos obrigatórios e todos em paralelo:

```
quality           lint · format · typecheck nos três projetos · dependency-cruiser
backend-unit      domínio, casos de uso com adaptadores InMemory, contratos de
                  evento, isolamento por assinatura e a fatia vertical
backend-adapters  adaptadores contra DynamoDB Local e MinIO
frontend          build de produção da SPA
infra             cdk synth com conta e região falsas
```

Nenhum job é opcional. O `dependency-cruiser` em particular é o que impede que "hexagonal" vire nomenclatura de pastas, e é também onde a direção única entre os três projetos (§5.1) é verificada.

**Todo job roda em toda execução, sem filtro por caminho alterado.** A suíte inteira leva cerca de um minuto, e um filtro que erra o recorte deixa passar exatamente a mudança que precisava ser verificada. O `infra` teria de rodar sempre de qualquer forma, porque referencia os artefatos dos outros dois e uma mudança neles pode invalidar o `synth`. Quando o tempo de execução passar a incomodar, o recorte por projeto alterado é a primeira otimização a fazer, e não antes disso.

**As dependências dos testes de adaptador têm uma definição só.** O job as sobe com `docker compose up -d --wait` sobre o `docker-compose.yml` da raiz, o mesmo arquivo que a máquina de quem desenvolve usa, com as imagens fixadas em versão exata e healthcheck nas duas. Declarar os mesmos containers uma segunda vez dentro do workflow é o que já fez a suíte passar localmente e falhar na integração contínua por uma diferença de imagem que ninguém tinha motivo para procurar.

### 20.2 Entrega

**Não existe deploy automático, e isso é uma decisão, não uma lacuna.** O ambiente sobe e desce por script, de uma estação de trabalho, com acompanhamento passo a passo:

```
deploy-aws/deploy.ps1     verifica a toolchain e a conta, instala o workspace, faz o
                          bootstrap da região quando preciso, sintetiza, implanta as
                          stacks de backend, escreve o .env.local da SPA a partir dos
                          outputs reais, constrói a SPA, implanta a hospedagem e
                          verifica o resultado por HTTP
deploy-aws/onboard.ps1    cria a primeira conta, a assinatura e o primeiro vault,
                          sempre pela API do produto
deploy-aws/destroy.ps1    derruba as stacks, preserva os dados por padrão e relata o
                          que sobreviveu
```

Cada passo é idempotente: quando um falha, corrija o que o relatório apontar e rode de novo.

Três razões sustentam a escolha. Não existe ambiente de staging, e um pipeline que implanta direto em produção sem um ambiente antes é pior do que nenhum. Existe uma pessoa integrando, então não há a corrida entre mudanças de gente diferente que é o problema que o deploy automático resolve. E `cdk deploy` sobre um domínio, um certificado e um user pool tem passos que dependem de propagação externa, cujo modo de falha é mais barato de ler no terminal do que num log de runner.

**O que faria essa decisão mudar**, na ordem em que provavelmente acontece: uma segunda conta AWS servindo de staging, uma segunda pessoa integrando na `main`, ou um teste de ponta a ponta contra um ambiente de pé que ninguém queira rodar à mão. Enquanto nenhuma das três for verdade, automatizar o deploy acrescenta um mecanismo a manter e não retira risco nenhum.

**Ponta a ponta.** A fatia vertical é verificada em processo, no job `backend-unit`, com adaptadores `InMemory` e as rotas montadas como o `core-monolith` as monta. Não há suíte de ponta a ponta contra um ambiente implantado, e o `deploy.ps1` fecha essa lacuna à sua maneira: ele termina verificando por HTTP que o que subiu responde.

---

## 21. Anti-padrões

### 21.1 Domínio

- Importar SDK da AWS em `domain/` ou `application/`, inclusive "só para um tipo".
- Passar `string` crua onde existe value object.
- Agregado que carrega o Markdown em vez do `ContentRef`.
- Operação de mutação sem `Authorship`.
- Lançar exceção no domínio em vez de devolver `Result`.
- Serviço de domínio que faz I/O.

### 21.2 Persistência

- Construir chave com `subscriptionId` vindo do argumento em vez do `SubscriptionContext`.
- Transação de nota que escreve no item `META` (§10.2).
- Campo `order` inteiro denso em vez de `Position` fracionária.
- Gravar Markdown no DynamoDB.
- Codificar vault, pasta, nome ou papel na chave do S3.
- Ler a tabela de outro serviço.
- Filtrar por assinatura depois da consulta em vez de na chave.

### 21.3 Borda

- Aceitar `subscriptionId` em path, query ou body.
- Devolver `403` para recurso de outra assinatura.
- Vazar vocabulário de MCP para dentro do caso de uso.
- Erro devolvido ao agente sem informação acionável (PP10).
- `update_note` sem `baseRevision`.
- Gerar sufixo automático em colisão de slug.

### 21.4 Projeções

- Consultar Discovery a partir do Knowledge, já que a direção é única.
- Tratar grafo, busca ou facetas como fonte da verdade.
- Deixar conteúdo apagado em qualquer índice de busca.
- Filtrar por assinatura dentro de um índice compartilhado em vez de usar índice por assinatura.

---

## 22. Checklist de nova funcionalidade

**Antes de criar o primeiro arquivo**
- [ ] Cada arquivo novo está no projeto certo (§5.1)? Stack ou construct em `memorysmith-infra`; tela em `memorysmith-frontend`; regra em `memorysmith-backend`.
- [ ] A mudança não cria dependência contra a direção única entre projetos.

**Domínio**
- [ ] O conceito tem termo na linguagem ubíqua (`software-vision.md` §3)? Se não, definir antes de codar.
- [ ] A regra de negócio tem código `RN-XXX` em `software-vision.md`?
- [ ] A invariante pertence a qual agregado? Se atravessa dois, é consistência eventual.
- [ ] Toda operação de mutação recebe `Authorship`?
- [ ] Value objects para todo valor com regra.

**Persistência**
- [ ] A chave começa por `S#{subscriptionId}`?
- [ ] A transação é da forma A ou da forma B (§10)? Se for de nota, **não** toca no `META`.
- [ ] Precisa de guard de unicidade? Em que escopo?
- [ ] O evento carrega `ContentRef` completo, quando há conteúdo envolvido?

**Borda**
- [ ] `policy.require(action, vault)` antes de qualquer outra coisa.
- [ ] Recurso proibido devolve `404`.
- [ ] O erro devolvido é acionável.
- [ ] Se é tool nova de MCP: entra no catálogo de `software-vision.md` §9.1 e dispara bump minor (§23).

**Projeções**
- [ ] Que projeções o evento invalida? Grafo? Busca? Contadores?
- [ ] A projeção é reconstruível do zero?

**Testes e documentação**
- [ ] Teste de domínio sem I/O.
- [ ] Teste de isolamento entre assinaturas se a funcionalidade tocar em chave nova.
- [ ] `CHANGELOG.md` atualizado no mesmo commit.
- [ ] Documento certo atualizado: regra em `software-vision.md`, mecanismo aqui, fato do domínio em `knowledge-base.md`.

---

## 23. Estratégia de versionamento

Três camadas, com fontes da verdade distintas. O fluxo operacional de bump está em `CLAUDE.md` § Política de versionamento.

### 23.1 Camada 1: versão do produto (SemVer)

Fonte da verdade: `CLAUDE.md` → Identidade do projeto → Versão base. Propagada para todo `package.json` e para o `CHANGELOG.md`.

### 23.2 Camada 2: versão do contrato

Dois contratos, com regras diferentes:

| Contrato | Versionamento | Quebra significa |
|---|---|---|
| **MCP** (público) | O catálogo de tools é o contrato. Remover tool, renomear argumento ou estreitar retorno é **major** | Conectores existentes param de funcionar |
| **API interna** (UI) | Prefixo de path `/v1`. Só a UI consome, então a migração é coordenada | Deploy coordenado de front e back |

Adicionar tool, adicionar argumento opcional ou ampliar retorno é **minor** nos dois casos.

### 23.3 Camada 3: versão de deploy

Cada stack CDK carrega a tag `app:version` com a versão do produto e `deploy:sha` com o commit. É o que permite responder "o que estava em produção quando isto aconteceu" a partir do próprio ambiente.

---

## 24. A linha entre microsserviços e monólito modular

O desenho-alvo é de microsserviços (D5). Vale registrar onde está a alavanca, porque hexagonal a torna barata nos dois sentidos.

Contextos, agregados, portas, adaptadores e estrutura de pastas são **idênticos** nas duas opções. O que muda:

| | Microsserviços (D5) | Monólito modular |
|---|---|---|
| Deployables | 6 Lambdas, 6 stacks, 6 tabelas | 1 Lambda, 1 stack, 1 tabela com prefixos por contexto |
| `AccessPolicy` | `HttpAccessPolicy` (rede) | `LocalAccessPolicy` (em processo) |
| Eventos | EventBridge | bus em processo, mesma interface `EventPublisher` |
| Custo | contratos versionados, tracing distribuído, deploy coordenado | fronteira depende de disciplina no CI |

**A troca é o `composition-root.ts` de cada serviço**, e nenhuma linha de `domain/` ou `application/` muda.

Uma ressalva: **`svc-audit` é o único que ganha algo real da separação física**, porque sua role de IAM restrita (§12.2) é o que torna o log imutável. Num monólito, essa garantia precisaria migrar para uma tabela com política própria e um papel dedicado.

**A alavanca está acionada na 0.1.0:** a primeira versão sai como monólito modular com o `svc-audit` à parte, exatamente a ressalva acima honrada. A separação em seis deployables acontece quando houver razão para ela (carga, time, ciclo de deploy), e não antes do primeiro usuário. Como a linha de corte é o composition root, adiar não cobra juros.

---

## 25. Sequência de construção

Ordem de dependência técnica, com critério de pronto verificável. A coluna **Versão** diz em qual recorte a entrega nasce, e o recorte de produto está em `software-vision.md` §15.

| # | Entrega | Critério de pronto | Versão |
|---|---|---|---|
| 1 | **Spike de auth MCP: proxy CIMD** (§13.3) | Conector registrado via CIMD e autenticado pelo Cognito funciona num cliente desktop **e** num cliente web, cumprindo os itens 1 a 6 de §13.3 | 0.1.0 |
| 2 | Monorepo, kernel, `SubscriptionId`, `Authorship`, taxonomia de erros (§15), CDK, CI com regra de dependência | Build quebra se `domain/` importar SDK da AWS | 0.2.0 |
| 3 | Domínio do Knowledge: `Vault`, `FolderTree`, `Position`, `Note` | Suíte do domínio verde **sem nenhuma dependência de AWS** | 0.2.0 |
| 4 | Adaptadores Dynamo, S3 e outbox; `ContentStore` com chave opaca e `ContentRef` completo no evento | 20 reorders concorrentes: nenhuma perda, nenhuma ordem indefinida. **50 notas criadas em paralelo no mesmo vault: nenhum retry por contenção** (§10.2) | 0.2.0 |
| 5 | `svc-access`: assinatura, seus membros e seu status, authorizer em dois estágios (§14.2) | Teste de isolamento entre assinaturas passa; recurso de outra assinatura devolve `404` e não `403`; token de plataforma não alcança o Knowledge | 0.2.0 |
| 6 | `svc-knowledge` HTTP completo | Reordenar pasta é 1 write no item da pasta; mover nota entre pastas é 0 bytes no S3; apagar nota mantém `read_note(asOf)` funcionando | 0.2.0 |
| 7 | `svc-audit` | `read_note(asOf)` devolve o conteúdo correto de uma data passada; update no log falha **por IAM** | 0.2.0 |
| 8 | `svc-agent`: o catálogo de tools | `get_vault_context` devolve o Markdown de `software-vision.md` §9.2, com as contagens, em **um** `Query` | 0.2.0 |
| 9 | UI de autoria | Criar um vault do zero, escrever guidance e template, e ler o histórico de uma nota sem tocar na API | 0.2.0 |
| 10 | `svc-discovery`: grafo, busca e facetas | Link pendente resolve ao criar a nota alvo; uma palavra escrita só no corpo de uma nota é encontrada, com o trecho e o heading de origem; o painel de curadoria sai de um `Query` nos contadores, sem varrer notas | 0.2.0 |
| 11 | Tools de descoberta; mover nota entre vaults; convites | `NoteId` e histórico preservados na troca de vault; backlinks quebrados avisados antes | 0.2.0 |
| 12 | `svc-portability` | Zip contém só `.md`, com a ordem legível na própria árvore de arquivos | 0.2.0 |

> **A entrega 3 antes da 4 não é preciosismo:** é o que prova que a inversão de dependência está de pé. Se o domínio precisar da AWS para ser testado, o hexágono já vazou.

### 25.1 O que a 0.2.0 fecha, e o que ela deixa aberto

A 0.2.0 constrói os seis bounded contexts, a infraestrutura inteira e a ligação da interface com a API. As entregas 2 a 12 nascem juntas porque o teste de isolamento, o de contenção e o de imutabilidade só existem quando existe o que testar, e adiar qualquer um deles significaria construir sobre uma propriedade não verificada.

Quatro decisões da implementação valem registro, porque quem lê o desenho precisa saber onde o código diverge dele e por quê:

- **O índice de conteúdo é uma varredura, não um índice invertido** (§11.2). Sob o teto de 2.000 notas por vault, varrer custa cerca de 1.000 unidades de leitura por consulta e dispensa manter postings em dia a cada escrita. A porta `ContentIndex` é o que torna a troca por um índice invertido, ou por um serviço gerenciado, uma mudança de adaptador se o teto do produto algum dia subir.
- **O Discovery mantém uma projeção própria da estrutura do vault**, alimentada pelos eventos de vault e de pasta. O Vault Context é respondido a partir dela, e consultar o Knowledge para obter o nome do vault e a árvore de pastas inverteria a direção única do §3.1, que é o que torna as projeções reconstruíveis.
- **O Discovery ganhou uma sexta rota, `GET /vaults/:v/graph`**, que devolve o grafo de links inteiro de um vault. A §14.1 declarava apenas a árvore a partir de uma nota, sob teto de profundidade, e ela responde a outra pergunta: a tela de grafo desenha o vault todo, sem raiz. A projeção de links já guardava exatamente isso na partição do vault, então a rota é uma consulta por prefixo e nada de novo é gravado. As arestas voltam como pares de índice sobre a lista de nós, e o teto de 2.000 nós vem declarado na resposta, porque um grafo cortado que se diz inteiro é pior que grafo nenhum.
- **A composição do monólito modular vive em `memorysmith-backend/apps/core-monolith`**, e é o único lugar que conhece dois contextos ao mesmo tempo. Os serviços continuam sem se importarem entre si, e a separação em seis deployables é a troca desse arquivo (§24).

---

## 26. Riscos técnicos

Riscos de produto estão em `software-vision.md` §16.

| Risco | Impacto | Resposta |
|---|---|---|
| Onboarding do OAuth do MCP ser penoso (Cognito sem CIMD nem DCR) | **Alto, mata a tese** | Proxy CIMD no `svc-agent` (§13.3), validado pelo spike da entrega 1; plano B é provedor de identidade com CIMD nativo |
| Vazamento entre assinaturas | **Alto** | Assinatura na chave líder, tipo obrigatório e teste de isolamento na suíte (§8, §19) |
| Contenção no item `META` sob ingestão em lote | **Alto, degrada o caminho quente** | Transação de nota não escreve no `META` (§10.2); contadores em itens próprios; critério de pronto da entrega 4 mede isso |
| S3 Vectors indisponível ou limitado na região | Médio | Porta `VectorIndex` já isola; plano B é OpenSearch Serverless, **sem tocar no domínio**, que é o tipo de troca que o hexágono existe para tornar barata |
| Bucket opaco: perder o DynamoDB deixa uma pilha de `.md` sem significado | Médio | PITR na tabela, a trilha do `svc-audit` com todo `(noteId, contentId, versionId)` já visto, e metadados imutáveis no objeto (§9.2) |
| Trilha de auditoria crescer sem controle | Médio | Evento é pequeno e append-only; retenção por assinatura; o conteúdo pesado fica no S3 |
| Vault acima do teto declarado degradar a busca | Médio | A varredura é sustentada por RN-KNW-010; subir o teto exige trocar o adaptador de `ContentIndex` antes, e não depois |
| Órfãos no S3 sem índice por `contentId` | Baixo | Só nascem de falha entre os passos 1 e 3 (§10.5): raros e baratos. Job semanal recolhe. Dívida registrada: a solução limpa custa um GSI no caminho quente e não se paga agora |
| 6 serviços antes do primeiro usuário | Médio | 0.1.0 sai como monólito modular com `svc-audit` separado (§24); expandir é trocar o composition root |
| Hexagonal virar só nome de pasta | Médio | Regra de dependência no CI desde a entrega 2 (§5.5, §20) |
| Chave fracionária de `Position` crescer sem limite | Baixo | Rebalanceamento sob demanda acima de 12 caracteres (§6.4, §17) |
