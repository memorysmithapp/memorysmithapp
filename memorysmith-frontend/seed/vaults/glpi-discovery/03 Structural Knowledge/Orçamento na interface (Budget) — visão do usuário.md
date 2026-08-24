---
title: Orçamento na interface (Budget) — visão do usuário
aliases: [Budget, Orçamento]
tags: [concept, management, budget, financial, doc]
type: concept
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-d1-005 · Orçamentos — definição, criação e abas|EV-2-d1-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Orçamento na interface (Budget) — visão do usuário

Objeto do módulo Management definido por um **valor** e um **período de tempo**, ao qual se anexam outros itens GLPI que consomem o montante disponível. Criado por **+ Add**, suporta template e um **budget type** (dropdown administrativo). Ver [[Campos do formulário de Orçamento]].

Abas:
- **Main tab** — tabela-resumo do gasto por tipo de item + total restante (somente leitura de custos);
- **Items** — lista os itens anexados e seus valores;
- Documents, Knowledgebase, External links, Notes, Historical, All.

O vínculo de itens ao orçamento é feito **na aba `Management` do item**, não no orçamento. Ver [[Vincular um item a um orçamento (procedimento)]] e a capacidade [[Gestão Financeira via Orçamentos (visão do usuário)]].

> [!note] Ponte doc×código
> Corresponde a [[Orçamentos e Custos]] e à camada financeira [[Infocom (dados financeiros do ativo)]] / [[Gestão Financeira de TI]].
