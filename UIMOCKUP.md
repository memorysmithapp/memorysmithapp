# MemoryVault.guru — UIMOCKUP.md
> Brief para montar um **mockup navegável** da Fase 1 (demo somente-leitura).
> Alvo: protótipo único, autocontido, gerado no Claude (artifact HTML) ou em ferramenta de design.
> Fonte da verdade do modelo: [DESIGN.md](DESIGN.md). Dados: Apêndice B do DESIGN, consolidados aqui em §8.

---

## 1. Objetivo

Um protótipo **clicável** que mostra a tese do produto: um conjunto de vaults Markdown organizados numa árvore navegável, com `README.md` do vault e `TEMPLATE.md` da pasta servindo de contexto. É **leitura, revisão e navegação** — não há autoria, edição, busca nem escrita por agente (isso é Fase 2+, ver DESIGN §11.3).

O mockup precisa provar três coisas em cliques:
1. **Navegar** a hierarquia `Tenant → Nó → Vault → Pasta → Nota`.
2. **Ler o contexto** — abrir o `README.md` de um vault e o `TEMPLATE.md` de uma pasta.
3. **Ver dois métodos opostos no mesmo modelo** — o PKM evergreen (Engineering) e o discovery rastreável (GLPI) lado a lado, sem UI condicional.

> Regra de ouro: **nada de motor de config, herança, procedência ou cadeados.** Isso foi removido do design (ADR-017/018). Se aparecer uma tela de "config herdada de X" ou "🔒 travado por", está errado.

---

## 2. Persona e enquadramento

- **Usuária logada:** Maria Furtado (`usr_maria`), papel **OWNER** em Consultoria Vega.
- **Multi-organização:** o seletor de organização (topo) demonstra o padrão do ADR-002 (uma identidade, N orgs). Maria tem uma org na demo; inclua no dropdown 1–2 orgs ilustrativas desabilitadas + a nota "trocar de organização é um clique, não um novo login" para vender o conceito.
- **Tom:** ferramenta de conhecimento — calma, densa, legível. Nada de dashboard colorido de métricas.

---

## 3. Restrições técnicas do protótipo

- **Um só arquivo HTML autocontido.** CSS e JS inline; sem CDN, sem fontes remotas, sem chamadas de rede.
- **Sem backend.** Todo o estado vem dos **dados-semente embutidos** (§8) como um objeto JS.
- **Navegação por estado in-memory** (ou hash de rota) — ver §6. Recarregar pode resetar; tudo bem.
- **Responsivo** (desktop first, mas não quebrar no mobile) e **theme-aware** (claro/escuro).
- **Markdown renderizado** de forma simples (títulos, listas, código, tabelas, blockquote, `[[wikilinks]]` como texto destacado). Um render mínimo próprio basta; não precisa de lib externa.

---

## 4. Layout global (app shell)

```
┌──────────────────────────────────────────────────────────────────────┐
│  MemoryVault   [ Consultoria Vega ▾ ]                 Maria Furtado ⬤  │  ← top bar
├───────────────┬──────────────────────────────────────────────────────┤
│  ÁRVORE       │  CONTEÚDO (muda conforme a seleção)                    │
│  (sidebar)    │                                                        │
│               │  ┌ breadcrumb ─────────────────────────────────────┐  │
│  Consultoria  │  │ Vega › Consultoria de Sistemas › … › Vault › /09 │  │
│   Vega        │  └──────────────────────────────────────────────────┘ │
│   └ Vega      │                                                        │
│     ├ Excel…  │  [ corpo da tela selecionada ]                        │
│     │  └ 📦   │                                                        │
│     └ Consul… │                                                        │
│        └ …    │                                                        │
│               │                                                        │
├───────────────┴──────────────────────────────────────────────────────┤
│  rodapé discreto: "Fase 1 · demo somente-leitura · dados-semente"     │
└──────────────────────────────────────────────────────────────────────┘
```

- **Top bar:** logo `MemoryVault`; **seletor de organização** (dropdown); avatar/nome da usuária com um menu simples (só ilustrativo). Um link "Membros" e um botão "Exportar" podem viver aqui ou no contexto do vault.
- **Sidebar esquerda:** a **árvore da hierarquia** (§5.1), expansível/colapsável. Vaults marcados com 📦. É o eixo de navegação principal.
- **Área de conteúdo:** troca conforme o item selecionado (nó, vault, pasta, nota, membros).
- Larguras: sidebar ~300px fixa (colapsável no mobile para um drawer), conteúdo fluido.

---

## 5. Telas

Cada tela lista **conteúdo** e **fonte de dados** (§8 / Apêndice B do DESIGN).

### 5.1 Árvore da hierarquia (sidebar, sempre visível)
Renderiza os nós e vaults como árvore. Ícone/rótulo por tipo:

```
🏢 Consultoria Vega            (TENANT_ROOT)
  └ 🏢 Vega                    (ORG)
     ├ 🗂 Excelência Técnica    (DEPARTMENT)
     │   └ 📦 Engineering Knowledge Vault
     └ 🗂 Consultoria de Sistemas (DEPARTMENT)
         └ 🗂 Discovery          (DIVISION)
             └ 🗂 GLPI 11 — Cliente Norte (PROJECT)
                 └ 📦 CAD Discovery — GLPI 11.0
```
- Cada tipo de nó tem um **badge** discreto (ORG, DEPARTMENT, DIVISION, PROJECT).
- Clicar num nó → tela **5.2**. Clicar num vault → tela **5.3**.
- Estado selecionado destacado. Expand/collapse com chevron.
- **Dados:** §8 `nodes`, `vaults`.

### 5.2 Página do nó
Cabeçalho com nome + badge de tipo + breadcrumb. Corpo:
- **Filhos diretos** (lista de sub-nós e vaults ancorados aqui).
- **Membros neste escopo** (mini-tabela: nome, papel) — link para tela 5.7.
- Nenhuma config, nenhuma herança. Um nó é só organização.
- **Dados:** `nodes`, `vaults`, `memberships`.

### 5.3 Página do vault  ⭐ (tela central)
Cabeçalho: `📦 {nome do vault}` + breadcrumb até a raiz + botão **Exportar** (5.8).
Abas:

| Aba | Conteúdo |
|---|---|
| **README** (default) | O `README.md` do vault, **renderizado**. Toggle "Ver Markdown cru". Se o vault não tiver README, empty state "Este vault ainda não tem README.md". |
| **Pastas** | Navegador de pastas (5.4). |
| **Templates** | Lista das pastas que têm `TEMPLATE.md`, cada uma abrindo o visualizador (5.6). |
| **Estado atual** | Projeção derivada: contagens por pasta e por status (barras/mini-tabela). É a única parte "calculada". Usar `stats.byStatus`. |
| **Contexto do agente** | O que a API `GET /agent-context?flavor=claude` serviria: o README embrulhado como `CLAUDE.md`. Mostrar em bloco monoespaçado com um seletor de `flavor` (claude / agents). Rótulo: "É isto que o agente lê antes de escrever (Fase 3)". |

- **Dados:** `vaults` (inclui o texto do README em §8), `folders`, `templates`, `stats`.
- Os dois vaults exercitam vocabulários opostos de `status` — respeite as cores de cada um (§7).

### 5.4 Navegador de pastas (dentro do vault)
Lista/tabela das pastas do vault:
| Coluna | Fonte |
|---|---|
| Pasta (path) | `folders.path` |
| Nº de notas | `folders.noteCount` |
| Template | badge **T** se `hasTemplate` |
- Clicar numa pasta → tela **5.5**.
- No vault GLPI, mostrar as 13 pastas numeradas por pergunta (use as 6 do §8 + as demais como linhas simples). No Engineering, as pastas PARA/Zettelkasten do §8.
- **Dados:** `folders`.

### 5.5 Página da pasta
Cabeçalho: `{path}` + breadcrumb. Layout em duas colunas quando houver template:
- **Coluna principal — Notas da pasta:** lista com título, `structuredId` (chip, ex. `EV-2-c1-014`), status (pill colorida), data. Clicar → tela **5.6 nota**.
- **Coluna lateral — `TEMPLATE.md`:** se `hasTemplate`, um card "Molde desta pasta" com o conteúdo do `TEMPLATE.md` renderizado + toggle cru. Rótulo advisory: "Sugestão — a nota não precisa preencher tudo." Se não houver, esconder a coluna.
- **Dados:** `notes` (filtradas por `folderId`), `templates`.

### 5.6 Visualizador de nota
Duas partes:
- **Frontmatter** — tabela chave/valor (monoespaçada), com `structuredId`, `status` (pill), `source_id`, etc. Campos do sistema (`mv_*`, `origin`) num grupo separado e mais apagado.
- **Corpo** — Markdown renderizado. Wikilinks `[[...]]` aparecem destacados (não precisam navegar).
- Badge de `origin` (SEED). Sem botão de editar (leitura).
- **Dados:** `notes` (frontmatter + `body` em §8).

### 5.7 Membros e papéis
Tabela: nome, e-mail, papel (badge OWNER/ADMIN/EDITOR/VIEWER), escopo (nó/vault), status (ACTIVE/INACTIVE/DISABLED). Seção "Convites pendentes" abaixo (do `pendingInvites`).
- Destacar `usr_bruna` (consultora externa, 3 orgs) para amarrar ao seletor de organização.
- Read-only: os botões de convidar/alterar papel podem existir **desabilitados** com tooltip "Fase 2".
- **Dados:** `users`, `memberships`, `pendingInvites`.

### 5.8 Exportar (modal)
Botão "Exportar" no vault abre um modal que **simula** o export (§6.2 do DESIGN): mostra a árvore legível que seria gerada —
```
CAD Discovery — GLPI 11.0/
├── README.md
├── 09 Evidence/
│   ├── TEMPLATE.md
│   └── EV-2-c1-014.md
└── …
```
com a nota "No S3 o storage é plano por ID; o export reconstrói esta árvore." Botão "Baixar .zip" pode ser fake (não precisa gerar arquivo).

### 5.9 Seletor de organização (dropdown no topo)
Lista as orgs da usuária. Ativa: Consultoria Vega. Itens ilustrativos desabilitados. Texto de rodapé do dropdown: "Uma identidade, várias organizações (ADR-002)."

---

## 6. Navegação / rotas

Estado navegável (hash de rota recomendado, para poder linkar):
```
#/                                     → dashboard/home (abre o primeiro vault ou a árvore)
#/node/{nodeId}                        → 5.2
#/vault/{vaultId}                      → 5.3 (aba README)
#/vault/{vaultId}/{aba}                → 5.3 (pastas | templates | estado | contexto)
#/vault/{vaultId}/folder/{folderId}    → 5.5
#/vault/{vaultId}/folder/{folderId}/note/{noteId}  → 5.6
#/members                              → 5.7
```
- A sidebar e o breadcrumb refletem sempre a rota atual.
- Estado inicial sugerido: abrir direto o vault **CAD Discovery** (`vlt_GLP01`), aba README — é o exemplo mais rico.

---

## 7. Componentes e estados visuais

- **Badge de tipo de nó:** ORG / DEPARTMENT / DIVISION / PROJECT — neutro, discreto.
- **Ícone de vault:** 📦.
- **Badge de template:** "T" quando a pasta tem `TEMPLATE.md`.
- **Chip de ID estruturado:** `EV-2-c1-014`, monoespaçado, fundo sutil.
- **Pill de status** — cores por vocabulário (cada vault tem o seu; não unificar):
  - Engineering: `seed` (âmbar), `growing` (lima), `evergreen` (esmeralda).
  - GLPI: `rascunho` (cinza), `revisao` (azul), `validada` (verde).
- **Badge de papel:** OWNER, ADMIN, EDITOR, VIEWER.
- **Badge de origin:** SEED (e, ilustrando Fase 3, MCP/WEB apagados).
- **Empty states** amigáveis (vault sem README, pasta sem template, pasta sem notas).
- **Tooltips "Fase 2/3"** em ações desabilitadas (convidar, editar, escrever).

### Estilo / tokens
Estética "ferramenta de conhecimento": tipografia legível, muito respiro, um acento só.
```
--accent:        indigo/violeta (ex. #6366F1)
--bg / --surface / --border / --text / --text-muted
--mono:          fonte monoespaçada para IDs, frontmatter, blocos de contexto
```
Suportar **claro e escuro** (via `prefers-color-scheme` +, se possível, um toggle no topo). Densidade confortável; cantos suaves; sombras leves.

---

## 8. Dados-semente (embutir no protótipo)

Consolidado do Apêndice B do DESIGN + textos de README/TEMPLATE do Apêndice A. Embuta como um objeto JS. Onde marcado *(ilustrativo)*, pode completar para dar densidade à tela, mantendo o espírito.

### 8.1 Nós e vaults
```json
{
  "tenant": { "tenantId": "tnt_01JQ8", "name": "Consultoria Vega", "slug": "vega" },
  "nodes": [
    { "nodeId": "nod_ROOT01", "parentId": null, "type": "TENANT_ROOT", "name": "Consultoria Vega" },
    { "nodeId": "nod_ORG01",  "parentId": "nod_ROOT01", "type": "ORG", "name": "Vega" },
    { "nodeId": "nod_DEP01",  "parentId": "nod_ORG01", "type": "DEPARTMENT", "name": "Excelência Técnica" },
    { "nodeId": "nod_DEP02",  "parentId": "nod_ORG01", "type": "DEPARTMENT", "name": "Consultoria de Sistemas" },
    { "nodeId": "nod_DIV01",  "parentId": "nod_DEP02", "type": "DIVISION", "name": "Discovery" },
    { "nodeId": "nod_PRJ01",  "parentId": "nod_DIV01", "type": "PROJECT", "name": "GLPI 11 — Cliente Norte" }
  ],
  "vaults": [
    { "vaultId": "vlt_ENG01", "nodeId": "nod_DEP01", "name": "Engineering Knowledge Vault",
      "hasReadme": true,
      "stats": { "folderCount": 6, "noteCount": 460,
                 "byStatus": { "seed": 12, "growing": 68, "evergreen": 380 } } },
    { "vaultId": "vlt_GLP01", "nodeId": "nod_PRJ01", "name": "CAD Discovery — GLPI 11.0",
      "hasReadme": true,
      "stats": { "folderCount": 13, "noteCount": 756,
                 "byStatus": { "rascunho": 0, "revisao": 693, "validada": 63 } } }
  ]
}
```

### 8.2 README.md do vault GLPI (renderizar na aba README)
```markdown
# CAD Discovery — GLPI 11.0

Substrato neutro: descreve o sistema como ele existe. Toda afirmação rastreável a uma evidência.

## Fontes autorizadas
- `SRC-001` — código-fonte GLPI 11.0.7
- `SRC-002` — documentação oficial (227 itens)

## Estrutura
Pastas numeradas por pergunta: `01 Overview` (o que é?), `03 Structural Knowledge`
(do que é composto?), `09 Evidence` (o que sustenta?), `11 Investigations` (o que falta?),
`13 MOCs` (como navegar?).

## Convenções
IDs estruturados: `EV-*` (evidências), `INV-*` (investigações).
Ciclo: `rascunho → revisao → validada` — só um humano valida.
```

### 8.3 README.md do vault Engineering *(ilustrativo)*
```markdown
# Engineering Knowledge Vault

Livros são temporários. Conceitos são permanentes. Conhecimento conectado gera valor.

PKM evergreen no estilo **Zettelkasten + PARA**.

## Estrutura
Notas atômicas conectadas por `[[wikilinks]]`. Estados de maturidade:
`seed → growing → evergreen`. MOCs (Maps of Content) para navegação.

## Convenções
Cada nota tem `aliases`, `tags`, `source`, `author`. Toda nota deve ter ao menos 1 link de entrada.
```

### 8.4 Pastas — vault GLPI
```json
[
  { "folderId": "fld_01", "vaultId": "vlt_GLP01", "path": "/01 Overview",             "noteCount": 9,   "hasTemplate": true },
  { "folderId": "fld_03", "vaultId": "vlt_GLP01", "path": "/03 Structural Knowledge", "noteCount": 172, "hasTemplate": true },
  { "folderId": "fld_06", "vaultId": "vlt_GLP01", "path": "/06 Data",                 "noteCount": 112, "hasTemplate": true },
  { "folderId": "fld_09", "vaultId": "vlt_GLP01", "path": "/09 Evidence",             "noteCount": 251, "hasTemplate": true },
  { "folderId": "fld_11", "vaultId": "vlt_GLP01", "path": "/11 Investigations",       "noteCount": 37,  "hasTemplate": true },
  { "folderId": "fld_13", "vaultId": "vlt_GLP01", "path": "/13 MOCs",                 "noteCount": 8,   "hasTemplate": true }
]
```
*(ilustrativo: complete até 13 pastas se quiser densidade — `02`, `04`, `05`, `07`, `08`, `10`, `12`.)*

### 8.5 Pastas — vault Engineering *(ilustrativo, PARA + Zettelkasten)*
```json
[
  { "folderId": "eng_f1", "vaultId": "vlt_ENG01", "path": "/01 Inbox",     "noteCount": 12,  "hasTemplate": false },
  { "folderId": "eng_f2", "vaultId": "vlt_ENG01", "path": "/02 Concepts",  "noteCount": 388, "hasTemplate": true },
  { "folderId": "eng_f3", "vaultId": "vlt_ENG01", "path": "/03 MOCs",      "noteCount": 20,  "hasTemplate": true },
  { "folderId": "eng_f4", "vaultId": "vlt_ENG01", "path": "/Projects",     "noteCount": 15,  "hasTemplate": false },
  { "folderId": "eng_f5", "vaultId": "vlt_ENG01", "path": "/Areas",        "noteCount": 18,  "hasTemplate": false },
  { "folderId": "eng_f6", "vaultId": "vlt_ENG01", "path": "/Resources",    "noteCount": 7,   "hasTemplate": false }
]
```

### 8.6 TEMPLATE.md — pasta `/09 Evidence` (GLPI)
```markdown
---
type: evidence
status: revisao
source_id:        # SRC-001 ou SRC-002
module:
locator:          # arquivo:linha ou caminho .rst
---
# {título}

## Trecho
## Interpretação
## Sustenta
```

### 8.7 TEMPLATE.md — pasta `/02 Concepts` (Engineering) *(ilustrativo)*
```markdown
---
type: concept
status: seed
aliases: []
tags: []
source:
author:
---
# {título}

## Conceito
## Estrutura / Fluxo
## Características
## Veja também
```

### 8.8 Notas
```json
[
  { "noteId": "not_B7", "vaultId": "vlt_GLP01", "folderId": "fld_09",
    "title": "EV-2-c1-014 — Capacities de ativo customizado", "structuredId": "EV-2-c1-014",
    "origin": "SEED", "status": "revisao",
    "frontmatter": { "type": "evidence", "status": "revisao", "created": "2026-07-11",
      "source_id": "SRC-002", "module": "Ativos e Inventário",
      "locator": "doc/assets/custom_assets.rst:88-131" },
    "body": "# EV-2-c1-014 — Capacities de ativo customizado\n\n## Trecho\n> Custom asset definitions expose a `capacities` array...\n\n## Interpretação\nCada capacity é um campo tipado anexado ao ativo customizado.\n\n## Sustenta\n[[INV-1-006]]" },

  { "noteId": "not_B9", "vaultId": "vlt_GLP01", "folderId": "fld_11",
    "title": "INV-1-006 — Catálogo de capacities de ativo customizado", "structuredId": "INV-1-006",
    "origin": "SEED", "status": "validada",
    "frontmatter": { "type": "investigation", "status": "validada", "created": "2026-06-19",
      "source_id": "SRC-001", "resolution": "Respondida por SRC-002 — ver EV-2-c1-014" },
    "body": "# INV-1-006 — Catálogo de capacities de ativo customizado\n\n## Pergunta\nQuais capacities um ativo customizado pode ter?\n\n## O que já se sabe\nO código expõe uma lista dinâmica.\n\n## O que falta\nConfirmar na documentação — resolvido: ver [[EV-2-c1-014]]." },

  { "noteId": "not_A1", "vaultId": "vlt_ENG01", "folderId": "eng_f2",
    "title": "Model Context Protocol (MCP)", "structuredId": null,
    "origin": "SEED", "status": "evergreen",
    "frontmatter": { "type": "concept", "status": "evergreen",
      "aliases": ["MCP","Protocolo de Contexto de Modelo"],
      "tags": ["ai","agents","protocol"], "source": "Anthropic — MCP Specification",
      "author": "Anthropic", "created": "2026-05-14" },
    "body": "# Model Context Protocol (MCP)\n\n## Conceito\nProtocolo aberto para conectar agentes a ferramentas e dados.\n\n## Estrutura / Fluxo\nCliente ↔ servidor MCP expõe tools/resources.\n\n## Veja também\n[[Agentes]], [[Tool Use]]" }
]
```
*(ilustrativo: adicione 3–6 notas por pasta aberta para as listas não ficarem vazias.)*

### 8.9 Pessoas e acesso
```json
{
  "users": [
    { "userId": "usr_maria",  "email": "maria@vega.com.br",  "displayName": "Maria Furtado",  "status": "ACTIVE" },
    { "userId": "usr_carlos", "email": "carlos@vega.com.br", "displayName": "Carlos Menezes", "status": "ACTIVE" },
    { "userId": "usr_bruna",  "email": "bruna@consultoriaexterna.com", "displayName": "Bruna Alves", "status": "ACTIVE", "tenantCount": 3 }
  ],
  "memberships": [
    { "userId": "usr_maria",  "scopeType": "NODE", "scopeId": "nod_ROOT01", "scopeLabel": "Consultoria Vega", "role": "OWNER",  "status": "ACTIVE" },
    { "userId": "usr_carlos", "scopeType": "NODE", "scopeId": "nod_DEP02",  "scopeLabel": "Consultoria de Sistemas", "role": "ADMIN",  "status": "ACTIVE" },
    { "userId": "usr_bruna",  "scopeType": "NODE", "scopeId": "nod_PRJ01",  "scopeLabel": "GLPI 11 — Cliente Norte", "role": "EDITOR", "status": "ACTIVE" }
  ],
  "pendingInvites": [
    { "inviteId": "inv_01", "email": "joao@vega.com.br", "scopeLabel": "Discovery", "role": "EDITOR", "invitedBy": "Carlos Menezes", "status": "PENDING" }
  ]
}
```

---

## 9. Fora de escopo (não desenhar)

- Editor de nota / criação / edição / salvar.
- Busca full-text, backlinks navegáveis, histórico.
- Qualquer UI de **configuração herdada, procedência, cadeados** (não existe mais no modelo).
- Console de plataforma (`/admin`), cadastro público, aceite de convite, fluxo de aprovação (Fase 2).
- Escrita por agente / MCP ao vivo (Fase 3) — só o **preview** "contexto do agente" na aba do vault.

---

## 10. Roteiro de demo (o clique que vende)

1. Abre em **CAD Discovery**, aba **README** → lê o charter e as fontes.
2. Vai em **Pastas** → entra em **/09 Evidence** → vê a lista de evidências + o **TEMPLATE.md** ao lado.
3. Abre **EV-2-c1-014** → frontmatter rastreável (`source_id`, `locator`) + corpo com `[[INV-1-006]]`.
4. Volta e abre o vault **Engineering** → README e status totalmente diferentes (`evergreen`), **mesmo modelo, zero UI condicional**.
5. Abre a aba **Contexto do agente** → "é isto que o agente lê antes de escrever".
6. Clica **Exportar** → mostra a árvore legível reconstruída.

Esse roteiro é o critério de aceite do mockup: se esses seis cliques fluem, o protótipo cumpriu seu papel.
