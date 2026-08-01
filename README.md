# MemoryVault.guru

> SaaS de gestão de conhecimento em **Markdown**, organizado por uma **hierarquia
> organizacional multinível** com herança de configuração e templates.

O MemoryVault.guru não é "mais um editor de notas". A proposta central é
**padronizar o jeito de fazer** de cada estrutura organizacional: cada nível da
hierarquia declara convenções — templates, frontmatter obrigatório, convenções de
nome, ciclo de vida das notas — que os níveis abaixo **herdam** e podem (ou não)
sobrescrever.

📄 A arquitetura completa está em **[DESIGN.md](DESIGN.md)**.

---

## A ideia em uma linha

Todo o produto se apoia em **uma única primitiva**: uma cadeia de nós onde cada
nível pode declarar convenções herdáveis.

```
Raiz (Tenant) → Organização → Departamento → Divisão → Projeto → Vault → Pasta → Nota
└──────────────── cadeia única de herança de configuração ────────────────┘
```

Reconhecer que **Vault, Pasta e até a Nota participam da mesma cadeia** é a decisão
de design mais importante do projeto: existe **um só algoritmo de resolução**, não
quatro.

---

## Princípios

| # | Princípio | Consequência prática |
|---|---|---|
| P1 | **Hierarquia genérica, não fixa** | Uma tabela `Node` recursiva com `type`, não cinco tabelas |
| P2 | **Configuração é dado, não schema** | Registry de chaves; adicionar propriedade ≠ migração |
| P3 | **Herança explícita e rastreável** | Todo valor efetivo carrega sua origem (`provenance`) |
| P4 | **Governança > conveniência** | Ancestral pode *travar* (`locked`) valores que descendentes não sobrescrevem |
| P5 | **Conteúdo portável** | Markdown + YAML frontmatter puro; export/import nativo, sem lock-in |
| P6 | **Simples na Fase 1, escalável por design** | Resolução em tempo de leitura agora; materialização depois |
| P7 | **Isolamento por chave-líder** | Todo item começa com `T#{tenant_id}` |

---

## O que a Fase 1 entrega

A Fase 1 é uma **demo somente-leitura** sobre vaults reais, carregados por um script
de seed (ADR-014). O objetivo é validar o **núcleo do modelo** — não construir todas
as telas.

- **Motor de herança** com procedência e locks (`§4` do DESIGN)
- **Config Key Registry** — propriedades como dado, não schema (`§3.2`)
- **Templates** versionados, com visibilidade pela cadeia de ancestrais (`§5`)
- **Vault / Pasta / Nota** na mesma cadeia de herança (`§6`)
- **README gerado** a partir da config resolvida — não escrito à mão (`§12.2`)
- **UI de leitura**: árvore, navegador de pastas, visualizador de nota, config com
  "herdado de", cadeados e conflitos
- **Export** do vault em Markdown puro
- **Autenticação mínima** via Cognito com tenant e usuários semeados

### Critério de pronto

Não é "as telas funcionam", e sim **"o README volta igual"**:

```
README.md original (escrito à mão)   ─┐
                                      ├── diff
README.md renderizado da config      ─┘
```

Se o documento gerado a partir da config importada reproduz o original — taxonomia,
tipos, frontmatter, ciclo de vida, convenções, contagens — então o modelo capturou a
realidade daquele vault (`§13.2`).

---

## Stack

**AWS Serverless.** Stack reduzido na Fase 1 (ADR-016):

- **CloudFront + S3** — SPA React
- **API Gateway HTTP API** — REST
- **Lambda** — Node 22, ARM64, esbuild, 512 MB
- **DynamoDB** — single-table, on-demand, PITR
- **S3** — conteúdo `.md`, versionado, SSE-KMS
- **Cognito** — pool único, plano Essentials, Managed Login
- **CDK v2 (TypeScript)** — IaC

Fora da Fase 1: EventBridge, SQS, Streams, Step Functions (aditivos, entram sem tocar
no modelo de dados), além de OpenSearch, WAF, Aurora e VPC.

Toda a lógica de domínio vive em `packages/core` — **TypeScript puro, sem imports de
`@aws-sdk/*`** — testável em milissegundos. REST e (na Fase 3) MCP são adaptadores
finos sobre os mesmos casos de uso.

---

## Roadmap

| Fase | Foco | Marco de conclusão |
|---|---|---|
| **1** | Demo por importação | Os três vaults carregados e o README gerado batendo com o original |
| **2** | Produto multi-tenant | Cadastro, aprovação, convites, papéis e o importador |
| **3** | Escrita por agente | Servidor MCP, validação impositiva, delegação atenuada |
| **4** | Produtividade e escala | Busca, histórico, backlinks, billing, SSO |

---

## Estrutura do repositório

> A definir conforme a implementação avança. A intenção de arquitetura
> (`packages/core` puro + adaptadores) está descrita em [DESIGN.md §8](DESIGN.md).

---

## Licença

[MIT](LICENSE).
