---
title: EV-2-g3-002 · Base de conhecimento — telas, alvos e busca
aliases: [EV-2-g3-002]
tags: [evidence, tools, knowledgebase, faq, search, targets, revision]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · source/modules/tools/knowledgebase.rst · Manage knowledge base"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-g3-002 · Base de conhecimento — telas, alvos e busca

> [!quote] source/modules/tools/knowledgebase.rst — "Manage knowledge base"
> Dois objetivos: (1) reunir conhecimento interno para técnicos; (2) prover uma **FAQ pública** para que usuários resolvam problemas simples sozinhos.
> "Only public FAQ items are visible to users of simplified interface. Other elements are visible only to technicians via standard interface."
> Cada artigo precisa de um ou mais **alvos** (entidade, grupo, perfil ou usuário) para ser legível. Sem alvo, é visível só pelo autor, marcado `unpublished`, e aparece na tabela `Unpublished articles` da home da KB.
> `.. versionchanged:: 11` — o alvejamento vale igual esteja o artigo na FAQ ou só na KB.
> "You can publish an article for everyone by targeting the root entity."
> Por padrão artigos **não** são traduzíveis (função ativável na configuração geral). É possível **anexar documentos**. Um artigo pode ser visível num intervalo de tempo (data início/fim).
> Estilo pré-formatado (`<pre>`) permite exibir tags como `<VirtualHost>` sem interpretação; modo HTML dá visibilidade completa do texto.
> Categorias e subcategorias organizam a navegação (via dropdowns).

> [!quote] Abas de navegação da KB e operadores de busca
> Abas: **Search** (padrão — artigos recentes, populares, últimas mudanças + busca), **Browse** (árvore de categorias), **Manage** (só administradores da KB — acesso rápido a artigos do usuário, não publicados etc.).
> Operadores do motor de busca da KB: `+` (palavra obrigatória), `-` (palavra proibida), `*` (trunca sufixo), `" "` (sequência literal), `< >` (define ordem/ranking), `()` (agrupa com `< >`).

> [!quote] Abas de um artigo
> **Knowledge base**: tabela com categoria, assunto, conteúdo, autor, data de criação/última modificação, número de visualizações e pertença à FAQ; se não publicado, aviso em vermelho.
> **Target**: gerencia os alvos do artigo (por padrão pessoal, só visível ao criador).
> **Edit**: modifica ou apaga o artigo (com permissão). Inclui abas comuns: elements, documents, historical, all.
> **Revision**: cada modificação salva cria uma **revisão** com a versão anterior; revisões podem ser exibidas e **restauradas**.
> **Comments**: usuários comentam e discutem o artigo.

## Sustenta
- [[Base de Conhecimento na interface (abas e navegação)]]
