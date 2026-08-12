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

`README.md` e `TEMPLATE.md` não são documentação: são **instruções executáveis** — é o que faz o agente escrever a nota certa, na pasta certa, no formato certo.

E não são nomes de arquivo. São **papéis**: o vault aponta um documento como seu guidance, a pasta aponta outro como seu template. Os nomes só aparecem na borda — no export e na UI.

## Interface

O contrato público é um **MCP server remoto** (OAuth 2.1), conector nativo em Claude web, desktop, Code, Cowork e CLI. A chamada central é `get_vault_context`, que devolve o guidance integral mais a árvore anotada com descrições e ordem — o equivalente a ler o README e rodar `ls -R` na pasta local, em uma chamada.

Sobre isso: grafo de links (árvore de dependências e backlinks), busca semântica, histórico por revisão e uma UI de autoria.

## Arquitetura

| | |
|---|---|
| Stack | AWS Serverless · Node.js/TypeScript |
| Dados | DynamoDB (todo o significado) + S3 (blobs de Markdown, chave opaca) + S3 Vectors (embeddings) |
| IA | Bedrock — Titan Text Embeddings V2 |
| Desenho | DDD tático + Hexagonal (Ports & Adapters), um deployable por bounded context |
| Isolamento | Por assinatura, desde a primeira linha: `SubscriptionId` na chave líder de todo item |
| Repositório | Três projetos: `memoryvault-backend`, `memoryvault-frontend`, `memoryvault-infra` |

**Assinatura → Workspace → Vault.** A assinatura é a fronteira de isolamento e a unidade de cobrança; o workspace é quem trabalha junto; o vault é o conhecimento. Enquanto não há billing, um administrador de plataforma autoriza cada assinatura — e ele não alcança conteúdo de cliente algum.

Seis serviços: `access`, `knowledge` (core), `discovery`, `audit`, `agent` (MCP), `portability`.

Cinco decisões que atravessam o resto:

- **O backend não interpreta o conteúdo.** O que vai dentro da nota — frontmatter inclusive — é decidido pelo Guidance e pelo Template do vault. O backend lê sintaxe universal de Markdown, nunca convenção de vault.
- **O S3 não sabe o que guarda.** Vault, pasta e nota são conceitos lógicos que vivem inteiramente no DynamoDB. No S3 há uma pilha plana de blobs de Markdown em chaves opacas, e o elo é um ponteiro que diz qual blob, em qual revisão, faz qual papel. Consequência: renomear, reordenar e mover — inclusive mover uma nota de vault — não podem tocar em byte nenhum, porque não há nada na chave que essas operações mudariam.
- **A assinatura é tipo, não convenção.** Não existe caminho de código que construa uma chave sem `SubscriptionId`: o compilador rejeita. É o mesmo mecanismo que impede uma sessão de plataforma de alcançar conteúdo — sem a claim, nenhum repositório é sequer instanciável.
- **O identificador da assinatura é perpétuo.** Aprovar, suspender, cancelar e reativar mudam um campo de status, nunca uma chave. O status governa acesso; jamais endereço.
- **O passado é imutável.** A trilha de auditoria é append-only por política de IAM, não por disciplina — e cada evento carrega a revisão exata do S3, o que permite reler a base como ela estava na data em que um trabalho foi emitido.

## Documentação

A especificação está dividida em três documentos com responsabilidades que não se sobrepõem — cada fato é declarado em exatamente um deles e referenciado pelos outros:

| Documento | Responde |
|---|---|
| **[docs/knowledge-base.md](docs/knowledge-base.md)** | O que é verdade sobre o domínio, independentemente deste produto: Markdown, prática de bases de conhecimento, MCP, recuperação, auditoria, LGPD, multi-tenancy |
| **[docs/software-vision.md](docs/software-vision.md)** | O que o produto faz e sob qual regra: visão, linguagem ubíqua, papéis, entidades, regras de negócio (`RN-XXX`), o contrato público de MCP, telas, recorte de versão |
| **[docs/architecture-guide.md](docs/architecture-guide.md)** | Como é construído: DDD tático, portas e adaptadores, chaves, transações, projeções, infraestrutura, testes, CI/CD, sequência de construção |

**[CLAUDE.md](CLAUDE.md)** reúne as orientações de trabalho no repositório: identidade do projeto, política de idioma, regras de desenho inegociáveis, versionamento, changelog, branches e pull requests.

## Estado

Fase de design. Ainda não há código.

O primeiro passo é um spike de autenticação: conectar um MCP mínimo autenticado por Cognito no Claude Desktop e no Claude web. É a decisão de maior risco do projeto — se a conexão não for fluida, a tese não se sustenta.

## Licença

MIT — ver [LICENSE](LICENSE).
