---
title: Base de Conhecimento na interface (abas e navegação)
aliases: [Knowledge base UI, FAQ, KB navegação]
tags: [tools, knowledgebase, faq, search, targets, revision, comments]
type: component
status: confirmed
source: "[[EV-2-g3-002 · Base de conhecimento — telas, alvos e busca|EV-2-g3-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Base de Conhecimento na interface (abas e navegação)

A base de conhecimento (**Tools > Knowledge base**) tem dois alvos: reunir **conhecimento interno para técnicos** e prover uma **FAQ pública** para autoatendimento. É a visão de usuário do modelo de código [[Base de Conhecimento (KnowbaseItem)]] e apoia a [[Base de Conhecimento (processo)]].

> [!note] Visibilidade e alvos (targets)
> Só itens da **FAQ pública** são visíveis a usuários da [[Interface Simplificada (Helpdesk-Self-Service)|interface simplificada]]; o resto, só a técnicos na [[Interface Padrão (Standard)|interface padrão]]. Um artigo precisa de um ou mais **alvos** (entidade, grupo, perfil ou usuário) para ser legível; sem alvo é `unpublished`, visível só ao autor e listado em *Unpublished articles*. Publicar para todos = alvejar a **entidade raiz**. Desde a v11, o alvejamento vale igual na FAQ ou só na KB.

> [!note] Organização e recursos
> Artigos podem ter **documentos anexos**, **datas de início/fim** de visibilidade e (se ativado na configuração geral) **tradução**. Categorias/subcategorias (dropdowns) organizam a navegação. Estilo `<pre>` exibe tags literais (ex.: `<VirtualHost>`).

## Abas de navegação
- **Search** (padrão): artigos recentes, populares, últimas mudanças e busca.
- **Browse**: árvore de categorias.
- **Manage**: só para administradores da KB — acesso rápido a artigos do usuário, não publicados, todos os não publicados.

## Abas de um artigo
- **Knowledge base**: metadados (categoria, assunto, conteúdo, autor, datas, nº de visualizações, pertença à FAQ); aviso vermelho se não publicado.
- **Target**: gerencia os alvos.
- **Edit**: modifica/apaga (com permissão).
- **Revision**: cada modificação salva vira uma **revisão** exibível e **restaurável**.
- **Comments**: discussão entre usuários.

> [!hint] Operadores do motor de busca da KB
> `+` obrigatória · `-` proibida · `*` trunca sufixo · `" "` sequência literal · `< >` ordem/ranking · `()` agrupa.

## Ver também
- [[Base de Conhecimento (KnowbaseItem)]] · [[Base de Conhecimento (processo)]] · [[Aba Base de Conhecimento (vincular artigos a um objeto)]] · [[Categorias ITIL de chamados]]
