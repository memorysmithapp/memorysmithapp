# MemoryVault.guru — DESIGN.md

> Documento de arquitetura do produto.
> Stack: **AWS Serverless · Node.js/TypeScript · DynamoDB + S3 + S3 Vectors + Bedrock**
> Arquitetura: **DDD + Hexagonal (Ports & Adapters) + microsserviços · multi-tenant desde a primeira linha**

---

## 1. O problema

Hoje o fluxo que funciona é: uma pasta de trabalho com arquivos `.md`, um `README.md` na raiz explicando ao agente como estruturar as notas, e o Obsidian por cima para navegar. O agente lê a pasta sempre que precisa de contexto.

Três coisas quebram nesse arranjo:

1. **Colaboração** — o conteúdo é local. Duas pessoas não trabalham no mesmo corpo de conhecimento.
2. **Navegação compartilhada** — o Obsidian é ótimo local e ruim como cliente de repositório remoto.
3. **Múltiplos cofres** — separar projetos exige múltiplas pastas soltas, sem um lugar que as liste.

O MemoryVault.guru é o backend remoto desse fluxo: **cofres de conhecimento em Markdown, com estrutura declarada, acessíveis nativamente pelas ferramentas de IA.**

### O ciclo de uso

O agente não só lê o vault — ele o **alimenta**. O caso concreto que o produto serve:

1. **Ingestão.** No Cowork, o agente lê um corpo de normas e legislação e escreve esse conhecimento como notas no vault — obedecendo ao `README.md` (o que este vault é), à estrutura de pastas (onde cada coisa vai) e ao `TEMPLATE.md` da pasta (como a nota se estrutura).
2. **Consumo.** Depois, outro trabalho — uma auditoria, um relatório — usa o mesmo vault como base de conhecimento estruturada.

Três consequências atravessam o documento inteiro:

- **A escrita via MCP é o caminho de ingestão.** Quem popula o vault é o agente, por construção.
- **Guidance, estrutura e template são instruções executáveis, não documentação.** São o que faz o agente escrever a nota certa, na pasta certa, no formato certo. Um `README.md` fraco ou uma descrição de pasta vaga degrada a qualidade do que entra — e o efeito só aparece depois, no consumo.
- **O domínio é regulado.** O vault sustenta trabalho de auditoria, então proveniência e histórico são parte do produto, não conformidade posterior (§9).

### A tese, em uma frase

O produto não é guardar `.md` — é **entregar contexto estruturado ao agente sem atrito**. Se ler um vault for mais trabalhoso que ler uma pasta local, o produto perdeu. Por isso o MCP não é um acessório: é a interface principal.

---

## 2. Decisões fundadoras

| # | Decisão | Alternativa descartada |
|---|---|---|
| D1 | **Acesso por agente via MCP server remoto** (OAuth 2.1, Streamable HTTP) | REST + token manual |
| D2 | **DynamoDB (estrutura e metadados) + S3 (corpo dos `.md`)** | Só S3; Postgres; Git repo por vault |
| D3 | **Multi-tenant desde a primeira linha** — `TenantId` na chave líder de todo item, em todo serviço | Adicionar tenant depois (= re-chavear tudo) |
| D4 | **Tenant → Workspace → Vault** | Vault direto no tenant |
| D5 | **DDD tático + Hexagonal, um deployable por bounded context** | Monólito modular (ver §14) |
| D6 | **Duas descobertas complementares: grafo de links e busca vetorial**, ambas projeções de eventos | Só busca lexical |
| D7 | **Proveniência e histórico imutável no núcleo** — quem escreveu, com qual agente, e o que a nota dizia naquele dia | Log de aplicação; versionamento só no S3 |

### Princípios

| # | Princípio | Consequência prática |
|---|---|---|
| P1 | **No fim é tudo Markdown** | O backend organiza e serve; não gera Markdown a partir de schema tipado |
| P2 | **Vault autônomo** | Cada vault se descreve no próprio `README.md`; sem herança entre vaults |
| P3 | **Molde é sugestão, não contrato** | `TEMPLATE.md` orienta; a nota não é obrigada a seguir |
| P4 | **Storage por ID opaco** | Renomear/mover/reordenar não toca no conteúdo do S3 |
| P5 | **Portável por construção** | Export devolve `.md` puros numa árvore de arquivos legível, sem formato proprietário |
| P6 | **O domínio não conhece a AWS** | `domain/` e `application/` sem um único `import` de SDK — regra verificada no CI |
| P7 | **Tenant é tipo, não convenção** | É impossível construir uma chave sem `TenantId`: o compilador impede |
| P8 | **Descoberta é derivada** | Grafo e vetores nunca são fonte da verdade; reconstruíveis a partir dos `.md` |
| P9 | **O passado é imutável** | O log de auditoria é append-only por IAM, não por disciplina |
| P10 | **O backend não interpreta o conteúdo** | O que vai dentro da nota — frontmatter inclusive — é decidido pelo Guidance e pelo Template. O backend lê sintaxe universal de Markdown (link, heading), nunca convenção de vault |

---

## 3. Linguagem ubíqua

Termo único por conceito, do código ao produto. Divergência aqui é o começo de todo modelo anêmico.

| Termo | Significa | **Não** confundir com |
|---|---|---|
| **Tenant** | Fronteira de isolamento, cobrança e identidade — um cliente | Workspace, conta de usuário |
| **Workspace** | Unidade de colaboração dentro do tenant; contém vaults e membros | Tenant, pasta |
| **Vault** | Um cofre de conhecimento autodescrito | Repositório, pasta raiz |
| **Guidance** | O `README.md` do vault: propósito + como estruturar as notas | Descrição curta do vault |
| **Folder** | Nó ordenado da árvore do vault, com `description` que diz *o que se guarda ali* | Diretório físico (não existe) |
| **Template** | O `TEMPLATE.md` de uma pasta: leiaute sugerido das notas dali | Schema, validação |
| **Note** | Um documento Markdown; o que vai dentro dele é decidido pelo Guidance e pelo Template | Registro, entidade tipada |
| **Position** | Chave fracionária que ordena irmãos | Índice denso, campo `order` |
| **Link** | Referência de uma nota a outra, extraída do Markdown | Hyperlink externo |
| **Edge** | Link já resolvido para um `NoteId` de destino | Link pendente |
| **Chunk** | Trecho de nota vetorizado, recortado por seção | Nota, parágrafo |
| **Authorship** | Quem escreveu: o humano **e** o agente usado | Usuário logado |
| **Revision** | O conteúdo exato de uma nota num instante, identificado pelo `versionId` do S3 | Evento, alteração |
| **Audit Event** | Registro append-only do que aconteceu, com autoria e revisão | Log de aplicação |
| **Vault Context** | Documento composto (Guidance + árvore anotada) entregue ao agente | Dump do vault |
| **Reserved Name** | `README.md` e `TEMPLATE.md` — os dois únicos nomes com significado | Convenção opcional |

---

## 4. Multi-tenancy

Tenancy não é uma feature: é a forma das chaves. Retrofitar tenant depois significa reescrever cada chave, cada índice, cada consulta e cada objeto do S3 — por isso entra antes de qualquer outra coisa (D3).

### 4.1 As três camadas de isolamento

**1. Chave líder.** Todo item de todo serviço começa por `T#{tenantId}`. Toda chave do S3 começa por `t/{tenantId}/`. Nenhuma consulta existe sem o prefixo — não há query que possa, mesmo por engano, atravessar tenants.

**2. Tipo, não disciplina (P7).** As portas de repositório recebem um `TenantContext` no construtor, e os construtores de chave só aceitam `TenantId` — um value object criável apenas a partir da claim do JWT.

```typescript
// domain/ports/VaultRepository.ts
export interface VaultRepository {
  findById(id: VaultId): Promise<Vault | null>;   // sem tenantId no argumento…
}

// adapters/outbound/dynamodb/DynamoVaultRepository.ts
export class DynamoVaultRepository implements VaultRepository {
  constructor(private readonly tenant: TenantContext, private readonly db: DynamoDBDocumentClient) {}
  // …porque o tenant é do repositório, resolvido por requisição.
}
```

O composition root instancia os repositórios **por requisição**, com o tenant vindo do token. Não existe caminho de código que construa um repositório sem tenant: o compilador rejeita. Isso troca uma regra que depende de code review por uma que depende do `tsc`.

**3. Origem do `TenantId`: sempre a claim, nunca a requisição.** O `tenantId` sai do JWT (claim customizada, injetada pelo *pre-token-generation* do Cognito) e **jamais** do path, query ou body. É o que fecha a porta de IDOR: pedir `/vaults/{id}` de outro tenant devolve 404, porque a chave montada nem chega lá.

> Para clientes que exijam isolamento criptográfico forte, o passo seguinte é credencial STS por requisição com `dynamodb:LeadingKeys` e prefixo de S3 na *session policy* — isolamento no IAM, não na aplicação. O ponto de extensão está pronto (o `TenantContext` já é onde a credencial seria resolvida); ligá-lo é configuração, não redesenho.

### 4.2 Tenant → Workspace → Vault

| Nível | Papéis | Existe para |
|---|---|---|
| **Tenant** | `TENANT_ADMIN` | Isolamento, cobrança, domínio de identidade |
| **Workspace** | `OWNER` · `EDITOR` · `VIEWER` | Colaboração: quem trabalha junto em quais vaults |
| **Vault** | herda do workspace | O conhecimento em si |

Signup cria tenant pessoal + workspace padrão automaticamente. **A UI esconde o nível de tenant enquanto houver só um workspace** — o usuário solo nunca vê a palavra "tenant". O modelo é completo desde o começo; a interface é que é progressiva.

---

## 5. Bounded contexts e microsserviços

Seis contextos, seis deployables, **cada um dono exclusivo dos seus dados** (uma tabela DynamoDB por serviço; nenhum serviço lê a tabela do outro).

```
                    ┌───────────────────────────────────────────┐
   Claude web/      │   svc-agent   (MCP · OAuth 2.1)           │
   desktop/code ───▶│   Agent Access Context — BFF/ACL          │
   cowork/cli       └───┬───────────────────────────┬───────────┘
                        │ HTTP interno (IAM)        │
   Web UI ─────┐        ▼                           ▼
               │  ┌──────────────────┐        ┌──────────────────────────┐
               ├─▶│  svc-knowledge   │══════▶ │  svc-discovery           │
               │  │  Knowledge Ctx   │eventos │  grafo de links          │
               │  │  ★ CORE DOMAIN   │  ║  ║  │  vetores (Bedrock)       │
               │  └────────┬─────────┘  ║  ║  └──────────────────────────┘
               │           │ authz      ║  ╚═▶┌──────────────────────────┐
               │           ▼            ║     │  svc-portability         │
               │  ┌──────────────────┐  ║     └──────────────────────────┘
               ├─▶│  svc-access      │══╝     ┌──────────────────────────┐
               │  │  Access Context  │═══════▶│  svc-audit  (append-only)│
               └─▶└──────────────────┘        └──────────────────────────┘
                     todos os eventos ────────────────▲
```

| Serviço | Contexto | Responsabilidade | Tipo |
|---|---|---|---|
| `svc-access` | Access | Tenants, workspaces, membros, papéis, convites; Lambda Authorizer | Supporting |
| `svc-knowledge` | Knowledge | Vaults, guidance, pastas, ordem, templates, notas | **Core** |
| `svc-discovery` | Discovery | Grafo de links e índice vetorial — duas projeções | Supporting |
| `svc-audit` | Audit | Trilha append-only: autoria, revisões, reconstrução por data | Supporting |
| `svc-agent` | Agent Access | MCP server; compõe o *Vault Context*; traduz domínio → tools | Supporting (ACL) |
| `svc-portability` | Portability | Export para zip legível | Generic |

**Context map:**

- `svc-knowledge` → `svc-access`: **Customer/Supplier**. Knowledge consome decisões de autorização; Access não conhece Knowledge.
- `svc-agent` → demais: **Anticorruption Layer**. O vocabulário do MCP nunca vaza para o domínio.
- `svc-discovery`, `svc-audit`, `svc-portability` ← todos: **Published Language** via eventos no EventBridge. Nenhum deles é consultado pelo core — só o alimentam.
- **Shared Kernel** (`packages/kernel`): só primitivas sem regra — `TenantId`, `Ulid`, `Slug`, `Authorship`, `Result`, `DomainEvent`, erros. Deliberadamente minúsculo: shared kernel grande é acoplamento disfarçado.

---

## 6. O domínio (DDD tático)

### 6.1 Agregados e invariantes

**`Vault` — Aggregate Root do Knowledge Context.** Fronteira de consistência: o vault e **toda a sua árvore de pastas**.

```typescript
// domain/knowledge/vault/Vault.ts — zero imports de AWS
export class Vault {
  private constructor(
    private readonly id: VaultId,
    private readonly workspaceId: WorkspaceId,
    private name: VaultName,
    private description: ShortText,
    private guidance: ContentRef | null,       // ponteiro para o README.md
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

`Authorship` é argumento obrigatório de toda operação que muda estado (§9.1). Não há mutação anônima no domínio — a assinatura torna isso impossível, e é o que garante que o evento emitido sempre saiba quem o causou.

Invariantes que **só** o agregado pode garantir — e que por isso definem a fronteira:

| # | Invariante |
|---|---|
| I1 | `slug` único entre irmãos |
| I2 | Profundidade máxima 6 |
| I3 | Mover uma pasta nunca cria ciclo (destino não pode ser descendente da origem) |
| I4 | Toda pasta tem `Position` que a ordena entre os irmãos |
| I5 | Remover pasta com filhas exige `RemovalPolicy` explícita (`CASCADE` \| `REJECT_IF_NOT_EMPTY`) |
| I6 | `Guidance` e `Template` são referências de conteúdo; o agregado nunca carrega o Markdown |

**`Note` — Aggregate Root separado.** Referencia `VaultId` + `FolderId` por identidade, não por objeto.

> **Por que Note ficou fora do agregado Vault?** Se estivesse dentro, criar uma nota exigiria carregar e travar a árvore inteira — e as invariantes de estrutura não dependem do conteúdo das notas. A regra "uma pasta com notas não pode ser removida sem política" é **consistência eventual** (via evento), não invariante transacional. É a decisão de modelagem mais importante do documento: é ela que mantém escrita de nota barata e concorrente — e escrita de nota é o caminho quente, porque é por ali que o agente alimenta o vault.

```typescript
export class Note {
  private constructor(
    private readonly id: NoteId,
    private readonly vaultId: VaultId,
    private folderId: FolderId,
    private title: NoteTitle,
    private slug: Slug,
    private body: ContentRef,           // versionId + SHA-256 + tamanho — o Markdown é opaco (P10)
    private readonly createdBy: Authorship,
    private updatedBy: Authorship,
    private version: number,
  ) {}
}
```

**`Workspace` — AR do Access Context.** Contém `Membership[]`. Invariantes: sempre ao menos um `OWNER`; e-mail único entre membros; convite pendente não vira membro sem aceite; membro pertence ao mesmo tenant.

**`NoteGraph` e `VaultIndex` — ARs do Discovery Context** (§8). São projeções: reconstruíveis a qualquer momento a partir dos `.md` (P8).

**`AuditTrail` — AR do Audit Context** (§9). Append-only: a única operação é `append`.

### 6.2 Value Objects

`TenantId` `WorkspaceId` `VaultId` `FolderId` `NoteId` (ULID) · `Slug` · `Position` (§6.3) · `FolderDescription` (1–500 chars, **obrigatória** — é ela que orienta o agente, então vazio não é aceito) · `ContentRef` (`{ key, versionId, sha256, bytes }`) · `Role` · `Authorship` · `AgentIdentity` · `LinkTarget` · `ChunkId`.

Todos imutáveis, autovalidados no construtor, comparados por valor. Nenhuma `string` crua cruza a fronteira do domínio.

### 6.3 `Position` — ordenação por índice fracionário

A ordem das pastas é requisito de produto, e a forma ingênua (campo `order` inteiro denso) obriga a reescrever todos os irmãos a cada arraste — em DynamoDB, N writes numa transação com teto de 100 itens.

Usamos **índice fracionário lexicográfico**: cada pasta guarda uma chave string; inserir entre `"a0"` e `"a1"` gera `"a0V"`. **Reordenar é um único `UpdateItem`**, independente do número de irmãos.

```typescript
Position.between(prev: Position | null, next: Position | null): Position
```

Empates (possíveis sob concorrência) são desempatados por `folderId` — a ordenação nunca fica indefinida. Quando uma chave passa de 12 caracteres, um comando de rebalanceamento redistribui os irmãos; é manutenção rara, não caminho quente.

### 6.4 Eventos de domínio

```
Access:     TenantCreated · WorkspaceCreated · MemberInvited · MemberJoined
            MemberRoleChanged · MemberRemoved
Knowledge:  VaultCreated · VaultRenamed · GuidanceUpdated · FolderAdded · FolderRenamed
            FolderDescribed · FolderMoved · FolderReordered · FolderRemoved · TemplateUpdated
            NoteCreated · NoteUpdated · NoteMoved · NoteDeleted
Discovery:  NoteLinksResolved · NoteIndexed · LinkBroken
```

Todo evento carrega `tenantId` e `Authorship`. Eventos de conteúdo carregam também o `versionId` do S3 (§9.3). Publicados via **outbox transacional** (§7.3), consumidos por `svc-discovery`, `svc-audit` e `svc-portability`. Adicionar consumidor não toca no core.

### 6.5 Serviços de domínio

- `FolderTreePlacement` — resolve "colocar depois de X dentro de Y" em `(parentId, Position)`, validando I2 e I3.
- `LinkExtractor` — extrai `[[wikilinks]]` e links Markdown relativos do **corpo** da nota. Só sintaxe universal: nenhum nome de campo, nenhuma convenção de vault (P10).
- `VaultContextComposer` — monta o *Vault Context* a partir do agregado e do `ContentStore`. Vive no domínio porque **o formato desse documento é o produto**, não detalhe de apresentação.

---

## 7. Persistência

### 7.1 Divisão DynamoDB / S3

| Onde | O quê | Por quê |
|---|---|---|
| **DynamoDB** | Estrutura, ordem, descrições, identidade da nota (título, slug, pasta, autoria), membros, arestas do grafo, trilha de auditoria | Consultável, transacional, condicional |
| **S3** | Corpo dos `.md`: guidance, templates, notas — todas as revisões | Sem teto de 400 KB, versionamento nativo, custo/GB menor |
| **S3 Vectors** | Embeddings dos chunks | Vetor nativo no S3, sem cluster para operar (§8.2) |

Chaves do S3 são **opacas e prefixadas por tenant** — `t/{tenantId}/v/{vaultId}/f/{folderId}/n/{noteId}.md`. Renomear, mover ou reordenar altera só o DynamoDB; nenhum byte se move no S3 (P4).

### 7.2 Single-table design — `mv-knowledge`

| Item | PK | SK | Atributos |
|---|---|---|---|
| Vault | `T#{t}#VAULT#{v}` | `META` | workspaceId, name, slug, description, guidanceRef, version, stats |
| Folder | `T#{t}#VAULT#{v}` | `FOLDER#{folderId}` | parentFolderId, name, slug, description, position, templateRef |
| Note | `T#{t}#VAULT#{v}` | `NOTE#{noteId}` | folderId, title, slug, bodyRef, createdBy, updatedBy, version |
| Guard de slug | `T#{t}#VAULT#{v}` | `SLUG#{parentId}#{slug}` | garante I1 via `attribute_not_exists` |
| Outbox | `T#{t}#VAULT#{v}` | `EVENT#{ulid}` | payload, ttl |

| Índice | PK | SK | Serve |
|---|---|---|---|
| `GSI1` | `T#{t}#WS#{ws}` | `VAULT#{v}` | listar vaults do workspace |
| `GSI2` | `T#{t}#FOLDER#{f}` | `NOTE#{title}` | listar notas de uma pasta, em ordem alfabética |

Carregar o agregado `Vault` = **um `Query` por `PK=T#{t}#VAULT#{v}`** com `begins_with(SK, 'FOLDER#')` + o item `META`. Uma chamada, uma partição, latência previsível.

`mv-access`: `T#{t}/META`, `T#{t}/USER#{userId}`, `T#{t}#WS#{ws}/META`, `T#{t}#WS#{ws}/MEMBER#{userId}`; `GSI1: USER#{userId} → T#{t}#WS#{ws}` responde "quais workspaces eu tenho".

### 7.3 Transações, concorrência e outbox

Toda mutação estrutural é **um** `TransactWriteItems`:

1. `Update` no item `META` com `ConditionExpression: version = :expected` — bloqueio otimista do agregado
2. `Put`/`Update`/`Delete` nos itens de pasta afetados
3. `Put` do guard de slug com `attribute_not_exists(PK)` — I1 no banco, não só em memória
4. `Put` dos eventos de domínio na **outbox**, na mesma transação

Conflito → `TransactionCanceledException` → o repositório traduz para `ConcurrencyError` → o caso de uso repete (até 3 vezes). O domínio nunca vê exceção da AWS: tradução é responsabilidade do adaptador.

**Outbox:** DynamoDB Streams → Lambda relay → EventBridge. Garante que mudança de estado e publicação sejam atômicas — sem isso, "gravei mas não publiquei" acontece e é silencioso. Num sistema cuja trilha de auditoria vive de eventos, esse silêncio seria um buraco no registro.

**Ordem de escrita com o S3:** conteúdo primeiro, DynamoDB depois — e o `versionId` devolvido pelo `PutObject` entra no `ContentRef` gravado. Um `.md` órfão é invisível e inofensivo; um ponteiro para conteúdo inexistente é erro visível ao usuário. Job semanal varre e remove órfãos.

---

## 8. Descoberta — grafo e vetores

Duas projeções sobre os mesmos eventos, respondendo a perguntas diferentes. Ambas **derivadas** (P8): apagar e reconstruir do zero é operação suportada, e é o plano de recuperação das duas.

| | **Grafo de links** | **Busca vetorial** |
|---|---|---|
| Responde | "o que esta nota referencia, e o que depende dela?" | "o que existe sobre este assunto?" |
| Fonte | links escritos no Markdown | significado do texto |
| Precisão | exata — o autor escreveu o link | aproximada |
| Custo | ~zero | embedding por escrita + query |
| Falha típica | link quebrado | resultado plausível e irrelevante |

São complementares por natureza: o grafo é **intenção declarada**, o vetor é **semelhança inferida**. Quem já organizou o vault ganha no grafo; quem está chegando ganha no vetor.

### 8.1 Grafo de links — árvore de dependências

`LinkExtractor` (§6.5) roda a cada `NoteCreated`/`NoteUpdated` e extrai duas formas do corpo da nota: `[[wikilink]]` e `[texto](caminho.md)` relativo. Cada link vira uma aresta.

Resolução por `slug` dentro do vault. Link cujo alvo ainda não existe **não é descartado** — vira aresta pendente e é resolvido no momento em que uma nota com aquele slug for criada. Sem isso, o grafo mente exatamente enquanto o vault está sendo escrito, que é quando ele é mais consultado.

> **No domínio regulado, o grafo é o rastro de fundamentação.** Uma nota de achado cita, no corpo, a nota da norma que a sustenta; `related_notes` responde "em que base normativa este achado se apoia?" percorrendo as arestas. Quem torna isso confiável é o `TEMPLATE.md` da pasta, que manda escrever a fundamentação como link (`Fundamento: [[lei-14133-art-75]]`) em vez de citar em prosa. O backend não sabe o que é um fundamento — ele só vê uma aresta, e é o vault que decide o que ela significa.

**Tabela `mv-discovery`:**

| Item | PK | SK |
|---|---|---|
| Aresta de saída | `T#{t}#VAULT#{v}` | `OUT#{fromNoteId}#{toNoteId}` |
| Aresta de entrada (backlink) | `T#{t}#VAULT#{v}` | `IN#{toNoteId}#{fromNoteId}` |
| Link pendente | `T#{t}#VAULT#{v}` | `PENDING#{slug}#{fromNoteId}` |

Aresta gravada nas duas direções: backlink vira um `Query`, não uma varredura. Travessia em BFS com **profundidade máxima 3 e teto de 200 nós**, deduplicando ciclos — um vault denso senão devolve o vault inteiro e o agente afoga.

Saídas: árvore de dependências a partir de uma nota, backlinks, links quebrados e notas órfãs (nenhuma aresta de entrada) — esta última sendo o relatório de higiene que mostra onde o vault está apodrecendo.

### 8.2 Busca vetorial — S3 Vectors + Bedrock

Pipeline por evento de nota:

```
NoteCreated/NoteUpdated
   └─▶ carrega o .md do S3
       └─▶ chunking por seção (heading), 1 chunk ≈ 1 ideia
           └─▶ prefixo de contexto em cada chunk:  vault › pasta › descrição da pasta › título
               └─▶ Bedrock Titan Text Embeddings V2 (1024 dims)
                   └─▶ upsert no índice vetorial do tenant, com metadados
```

**O prefixo de contexto no chunk é o detalhe que decide a qualidade.** Um chunk solto ("o limite é 200 por conta") é irrecuperável; o mesmo chunk precedido de `Pesquisa de Produto › Evidence › Fatos observados em campo › Capacities de ativo customizado` é buscável. A descrição da pasta, que você já escreve para orientar o agente, vira sinal de recuperação de graça — o mesmo texto trabalhando duas vezes.

**Isolamento:** um índice vetorial **por tenant**, não um índice global filtrado por metadado. Filtro de metadado é controle de acesso por convenção; índice separado é fronteira física. Dentro do índice, filtro por `vaultId` e `folderId` restringe a busca.

Deleção de nota remove os vetores dos seus chunks — sem isso, o índice devolve conteúdo apagado, o que é problema de privacidade, não de qualidade.

> ⚠️ **Risco aberto.** Confirmar disponibilidade do **S3 Vectors** na região escolhida e seus limites (índices por bucket, dimensões, throughput). Se não atender, o plano B é OpenSearch Serverless com coleção vetorial — mesma porta `VectorIndex`, adaptador diferente, **zero mudança no domínio**. É exatamente o tipo de troca que o hexágono existe para tornar barata.

### 8.3 Portas

```typescript
export interface LinkGraph {
  replaceOutgoing(note: NoteId, links: LinkTarget[]): Promise<void>;
  dependencyTree(root: NoteId, depth: Depth): Promise<GraphNode>;
  backlinks(note: NoteId): Promise<NoteRef[]>;
  broken(vault: VaultId): Promise<BrokenLink[]>;
  orphans(vault: VaultId): Promise<NoteRef[]>;
}

export interface VectorIndex {
  upsert(chunks: Chunk[]): Promise<void>;
  removeByNote(note: NoteId): Promise<void>;
  query(q: EmbeddedQuery, filter: IndexFilter, k: number): Promise<ScoredChunk[]>;
}

export interface Embedder { embed(texts: string[]): Promise<Vector[]>; }
```

`S3VectorsIndex`, `BedrockEmbedder` e `DynamoLinkGraph` são adaptadores. O domínio de Discovery conhece `Chunk`, `Edge` e `Depth` — nunca conhece Bedrock.

---

## 9. Proveniência e histórico

O vault sustenta trabalho de auditoria em ambiente regulado. Isso muda o que "guardar uma nota" significa: além do conteúdo atual, o sistema precisa responder **quem escreveu, com qual agente, quando, e o que a nota dizia na data em que o trabalho foi emitido**.

### 9.1 Authorship — quem escreveu

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

O humano é sempre identificado — mesmo quando é o Cowork que grava, o token pertence a quem autorizou o conector. O agente é identificado pelo `client_id` do OAuth. É esse par que transforma *"escrito por Heitor"* em *"escrito pelo Claude via Cowork, em nome do Heitor, em 12/03"* — a diferença entre um registro e um registro defensável.

Quem preenche é o adaptador de entrada: `McpToolAdapter` resolve o agente a partir do token; o adaptador HTTP da UI o deixa nulo. O domínio recebe `Authorship` pronto e obrigatório (§6.1).

### 9.2 Audit Context — `svc-audit`

Consumidor de **todos** os eventos do bus, de todos os serviços.

| Item | PK | SK | Atributos |
|---|---|---|---|
| Audit Event | `T#{t}#{subject}#{subjectId}` | `AT#{timestamp}#{eventUlid}` | type, authorship, versionId, payload |

com `subject ∈ {WORKSPACE, MEMBER, VAULT, FOLDER, NOTE}`. Um `Query` por `PK` devolve a linha do tempo completa de qualquer objeto, em ordem cronológica, sem varredura.

**A imutabilidade não é convenção (P9): a role do Lambda tem `Deny` explícito em `UpdateItem` e `DeleteItem` na tabela.** Não existe caminho — nem por bug, nem por operador — que reescreva o passado. É a diferença entre "não alteramos o log" e "não conseguimos alterar o log", e só a segunda serve diante de um regulador.

### 9.3 Revision — o que a nota dizia naquele dia

O bucket é versionado, então cada gravação de `.md` produz um `versionId` imutável no S3. **O evento carrega esse `versionId`** — é o detalhe que liga *"aconteceu algo"* a *"o conteúdo era este"*. Sem capturá-lo, o log informa que a nota mudou e não consegue mostrar para quê, o que a torna inútil justamente na pergunta que a auditoria faz.

Reconstruir a nota numa data:

1. no log, o último evento daquela nota com `timestamp ≤ data`
2. `GET` no S3 com o `versionId` daquele evento

`read_note(vault, note, asOf?)` expõe isso ao agente (§10.1): um trabalho de auditoria pode ser refeito lendo a base **como ela estava na data de emissão**, não como está hoje. É o que permite defender uma conclusão antiga sem que uma norma atualizada depois a contamine retroativamente.

Para tenants com exigência formal de retenção, **S3 Object Lock em modo compliance** trava as versões contra remoção pelo prazo configurado — inclusive contra a conta raiz.

---

## 10. O MCP server

Endpoint: `https://mcp.memoryvault.guru/mcp` (Streamable HTTP, OAuth 2.1). Conector nativo em Claude web, desktop, Code, Cowork e CLI.

### 10.1 Ferramentas

| Tool | Assinatura | Papel |
|---|---|---|
| `list_vaults` | `()` | Vaults visíveis, com descrição |
| **`get_vault_context`** | `(vault)` | **A chamada principal.** Guidance integral + árvore com descrições, ordem e quais pastas têm template |
| `get_template` | `(vault, folder)` | O `TEMPLATE.md` da pasta — a ler antes de escrever |
| `list_notes` | `(vault, folder?)` | Índice de notas |
| `read_note` | `(vault, note, asOf?)` | Markdown completo; com `asOf`, a revisão vigente naquela data (§9.3) |
| `search_notes` | `(vault, query)` | Lexical: título e pasta |
| `semantic_search` | `(vault, query, k?, folder?)` | Vetorial: trechos por significado, com a nota de origem |
| `related_notes` | `(vault, note, depth?)` | Árvore de dependências pelo grafo de links |
| `backlinks` | `(vault, note)` | Quem aponta para esta nota |
| `note_history` | `(vault, note)` | Linha do tempo: quem alterou, quando, com qual agente |
| `create_note` | `(vault, folder, title, content)` | O caminho de ingestão (§1) |
| `update_note` | `(vault, note, content)` | Atualização, com nova revisão registrada |

Saída de `get_vault_context` — o agente recebe exatamente o que hoje obtém lendo seu README e rodando `ls -R`:

```markdown
# Vault: Normas e Legislação
<conteúdo integral do README.md>

## Estrutura
1. **Normas** — Texto normativo por artigo. Uma norma por nota, sempre com órgão e vigência. (48 notas, tem TEMPLATE.md)
2. **Achados** — Achados de auditoria. Todo achado cita a norma em `source`. (23 notas, tem TEMPLATE.md)
3. **Trabalhos/** — Relatórios emitidos. (5 notas)
   3.1. **2026** — Emitidos neste exercício. (5 notas, tem TEMPLATE.md)
```

A descrição de cada pasta é o que direciona a escrita do agente na ingestão — por isso ela é obrigatória no domínio (§6.2), não opcional.

`svc-agent` é uma **ACL**: `McpToolAdapter` traduz tool call → comando de caso de uso e volta, e resolve o `Authorship` a partir do token. Nenhum vocabulário de MCP entra no core, e trocar de protocolo amanhã é trocar um adaptador.

### 10.2 Escrita por agente

`create_note`/`update_note` respeitam o papel no workspace (`VIEWER` recebe erro). O servidor **não valida** a nota contra o `TEMPLATE.md` — molde é sugestão (P3) — mas a descrição da tool instrui a chamar `get_template` antes, e o erro de argumento faltante devolve o template junto. Toda escrita grava `Authorship` completo e gera uma revisão nova (§9.3).

### 10.3 Autenticação

MCP remoto exige OAuth 2.1 com *Protected Resource Metadata*. Cognito como Authorization Server; `svc-agent` como Resource Server. O `tenantId` entra no token pelo *pre-token-generation trigger* (§4.1), e o `client_id` do conector vira `AgentIdentity` (§9.1).

> ⚠️ **Risco aberto nº 1.** O Cognito não faz *Dynamic Client Registration*. Os clientes Claude aceitam `client_id`/`client_secret` informados à mão na configuração do conector, o que resolve — com atrito no onboarding. **Primeiro spike, antes de qualquer outra coisa:** conectar um MCP mínimo autenticado por Cognito no Claude Desktop **e** no Claude web. Se o atrito for alto, trocar por WorkOS AuthKit ou Auth0 (ambos com DCR). É a decisão de maior risco do projeto: se a conexão não for fluida, a tese cai.

---

## 11. API interna e UI

### 11.1 Rotas (consumidas pela UI; o contrato público é o MCP)

```
svc-access       POST /workspaces · GET /workspaces · POST /workspaces/:ws/members
                 POST /invites/:token/accept · GET /authz   (Lambda Authorizer)
svc-knowledge    POST /vaults · GET /vaults/:v · PUT /vaults/:v/guidance
                 POST /vaults/:v/folders · PATCH /vaults/:v/folders/:f
                 POST /vaults/:v/folders/:f/reorder   { afterFolderId | null }
                 PUT  /vaults/:v/folders/:f/template
                 POST|GET|PUT|DELETE /vaults/:v/notes[/:n]
svc-discovery    GET  /vaults/:v/notes/:n/graph?depth= · GET /vaults/:v/notes/:n/backlinks
                 GET  /vaults/:v/health   (links quebrados, órfãs)
                 POST /vaults/:v/search   { query, mode: lexical | semantic }
svc-audit        GET  /notes/:n/history · GET /notes/:n/revisions/:versionId
                 GET  /vaults/:v/activity?from=&to=
svc-portability  POST /vaults/:v/exports · GET /exports/:id   → URL pré-assinada
```

Nenhuma rota recebe `tenantId`: ele vem do token (§4.1).

Roteamento por path num CloudFront único (`api.memoryvault.guru/knowledge/*` etc.). Chamadas entre serviços via API Gateway com **IAM auth** — nunca por rede aberta.

**Autorização:** o Lambda Authorizer do `svc-access` valida o JWT do Cognito, resolve tenant e memberships, e injeta tudo no contexto da requisição (cache 5 min). Os demais serviços consomem a decisão; nenhum deles lê a tabela do Access.

### 11.2 UI

| Tela | Conteúdo |
|---|---|
| Lista de vaults | cards: nome, descrição, nº de notas, última atualização |
| Vault → Guidance | editor Markdown com preview; ajuda sugerindo seções (propósito, convenções, nomenclatura) |
| Vault → Estrutura | árvore com **drag-and-drop para reordenar**, criar/renomear pasta, editar descrição inline |
| Pasta → Template | editor do `TEMPLATE.md` |
| Nota | leitura e edição; painel lateral com backlinks e relacionadas |
| Nota → Histórico | linha do tempo com autoria (humano + agente) e diff entre revisões |
| Vault → Busca | campo único, alternador lexical/semântica |
| Vault → Atividade | quem escreveu o quê no período — visão de vault, não de nota |
| Vault → Saúde | links quebrados e notas órfãs |
| Workspace → Membros | convidar por e-mail, definir papel |
| Vault → Conectar | URL do MCP + passo a passo por cliente |

A UI é a única superfície de leitura do produto. Isso levanta a régua da tela de nota e da árvore: elas precisam ser confortáveis para **ler**, não só para editar.

---

## 12. Export

`svc-portability` consome os eventos, monta o zip e devolve URL pré-assinada. Árvore legível, não a de IDs opacos:

```
Normas e Legislação/
├── README.md
├── 01 Normas/
│   ├── README.md            ← a descrição da pasta, materializada
│   ├── TEMPLATE.md
│   └── lei-14133-art-75.md
├── 02 Achados/
│   ├── README.md
│   └── TEMPLATE.md
└── 03 Trabalhos/
    └── 01 2026/
```

O **prefixo numérico codifica a ordem** — é a única forma de preservá-la num sistema de arquivos, que não tem ordem própria. Os links saem intactos no texto. Zero lock-in é requisito, não cortesia: é o que torna o produto seguro de adotar num contexto em que a base precisa sobreviver ao fornecedor.

---

## 13. Infraestrutura

| Camada | Escolha |
|---|---|
| Compute | **Um Lambda por serviço** (Node.js 22, ARM64), roteamento interno com Hono |
| API | API Gateway HTTP API por serviço, atrás de um CloudFront |
| Dados | Uma tabela DynamoDB por serviço (on-demand, PITR) + bucket S3 versionado (Object Lock opcional) + bucket S3 Vectors |
| IA | Bedrock — Titan Text Embeddings V2 |
| Eventos | EventBridge (bus `mv-events`) + DynamoDB Streams para a outbox |
| Identidade | Cognito user pool + pre-token-generation trigger (claim `tenant_id`) |
| Front-end | React + Vite (SPA) em S3 + CloudFront |
| IaC | AWS CDK (TypeScript), um stack por serviço + um de rede/domínio |
| Observabilidade | Powertools for AWS Lambda; `tenantId` em **toda** linha de log e como dimensão de métrica |

> **Um Lambda por serviço, não um por rota:** menos cold starts, um composition root por deployable, e a fronteira que importa (o bounded context) continua sendo a unidade de deploy.

**Estrutura do monorepo (pnpm):**

```
memoryvault/
├── packages/{kernel,contracts}/
├── services/{access,knowledge,discovery,audit,agent,portability}/
│   └── src/{domain,application,adapters/{inbound,outbound},main}/
├── apps/web/
└── infra/
```

**Regra de dependência, verificada no CI** (`dependency-cruiser`): `domain` não importa `application`, `adapters` nem lib externa exceto `kernel`. `application` importa só `domain`. Build quebra se violar — sem essa checagem, hexagonal vira nomenclatura de pastas em três sprints.

**Testes:** domínio em unit puro (sem I/O, sem mock de framework) · casos de uso com adaptadores `InMemory` · adaptadores contra DynamoDB Local + MinIO · contract tests dos eventos com schemas Zod · e2e por fatia vertical · **teste de isolamento por serviço** (dois tenants, o de A tentando ler o de B, esperando 404) · **teste de imutabilidade do audit** (tentativa de update no log deve falhar por IAM, não por código).

---

## 14. A linha que separa microsserviços de monólito modular

O desenho é de microsserviços, como pedido. Vale registrar onde está a alavanca, porque hexagonal a torna barata nos dois sentidos.

Contextos, agregados, portas, adaptadores e estrutura de pastas são **idênticos** nas duas opções. O que muda:

| | Microsserviços (D5) | Monólito modular |
|---|---|---|
| Deployables | 6 Lambdas, 6 stacks, 6 tabelas | 1 Lambda, 1 stack, 1 tabela com prefixos por contexto |
| `AccessPolicy` | `HttpAccessPolicy` (rede) | `LocalAccessPolicy` (em processo) |
| Eventos | EventBridge | bus em processo, mesma interface `EventPublisher` |
| Custo | contratos versionados, tracing distribuído, deploy coordenado | fronteira depende de disciplina no CI |

**A troca é o `composition-root.ts` de cada serviço** — nenhuma linha de `domain/` ou `application/` muda. Uma ressalva: o `svc-audit` é o único que ganha algo real da separação física, porque sua role de IAM restrita (§9.2) é o que torna o log imutável. Num monólito, essa garantia precisaria migrar para uma tabela com política própria e um papel dedicado.

---

## 15. Sequência de construção

Ordem de dependência técnica. O produto é um só e sai completo.

| # | Entrega | Critério de pronto |
|---|---|---|
| 1 | **Spike de auth MCP** | Conector Cognito autentica no Claude Desktop **e** no Claude web |
| 2 | Monorepo, kernel, `TenantId`, `Authorship`, CDK, CI com regra de dependência | Build quebra se `domain/` importar SDK da AWS |
| 3 | Domínio do Knowledge: `Vault`, `FolderTree`, `Position`, `Note` | Suíte do domínio verde **sem nenhuma dependência de AWS** |
| 4 | Adaptadores Dynamo + S3 + outbox, com `versionId` no `ContentRef` | 20 reorders concorrentes: nenhuma perda, nenhuma ordem indefinida |
| 5 | `svc-access`: tenants, workspaces, membros, authorizer | Teste de isolamento cross-tenant passa |
| 6 | `svc-knowledge` HTTP completo | Reordenar pasta = 1 write, 0 bytes movidos no S3 |
| 7 | `svc-audit` | `read_note(asOf)` devolve o conteúdo correto de uma data passada; update no log falha por IAM |
| 8 | `svc-discovery`: grafo + vetores | Link pendente resolve ao criar a nota alvo; busca semântica traz o chunk certo com a nota de origem |
| 9 | `svc-agent`: as 12 tools | `get_vault_context` devolve o Markdown de §10.1 |
| 10 | UI | Criar um vault do zero e ler o histórico de uma nota sem tocar na API |
| 11 | `svc-portability` | Zip contém só `.md`, com a ordem legível na própria árvore de arquivos |

A 3 antes da 4 não é preciosismo: é o que prova que a inversão de dependência está de pé. Se o domínio precisar da AWS para ser testado, o hexágono já vazou.

---

## 16. Riscos

| Risco | Impacto | Resposta |
|---|---|---|
| Onboarding do OAuth do MCP ser penoso | **Alto** — mata a tese | Primeiro spike; trocar de IdP se preciso |
| Vazamento cross-tenant | **Alto** | Tenant na chave líder + tipo obrigatório + teste de isolamento na suíte |
| S3 Vectors indisponível ou limitado na região | Médio | Porta `VectorIndex` já isola; plano B é OpenSearch Serverless, sem tocar no domínio |
| Trilha de auditoria crescer sem controle | Médio | Evento é pequeno e append-only; retenção por tenant, e o conteúdo pesado fica no S3 |
| Custo de embedding em vault que muda muito | Baixo | Só re-embeda chunk cujo hash mudou, não a nota inteira |
| Busca semântica devolver plausível-porém-errado | Médio | Sempre citar nota e seção de origem; o agente decide com a fonte à vista |
| Grafo explodir em vault denso | Médio | Teto de profundidade 3 e 200 nós na travessia |
| 6 serviços antes do primeiro usuário | Médio | §14: colapsar é trocar o composition root, com a ressalva do `svc-audit` |
| Hexagonal virar só nome de pasta | Médio | Regra de dependência no CI desde a entrega 2 |
