---
title: EV-2-d1-005 · Orçamentos — definição, criação e abas
aliases: [EV-2-d1-005]
tags: [evidence, management, budget, doc, financial]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · source/modules/management/budgets.rst · Budgets"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-d1-005 · Orçamentos — definição, criação e abas

> [!quote] budgets.rst · "Budgets"
> "A budget in GLPI is defined by an amount and a time period. Other GLPI items can be attached to this budget and will then, by providing their value, modify the budget available amount." Criar um orçamento habilita a funcionalidade de gestão administrativa e financeira para todos os outros itens GLPI. É possível acompanhar a evolução de um orçamento rastreando o valor de cada item anexado.

> [!quote] budgets.rst · notas
> "Attaching a GLPI item to a budget is done via tab `Management` of the item!" Ao exibir um orçamento de uma subentidade, o total restante do orçamento não fica visível. O total restante pode ser **negativo** se a soma dos valores dos itens anexados exceder o valor do orçamento.

> [!quote] budgets.rst · "Add a new budget"
> Novo orçamento: botão **+ Add** no topo; preencher a informação requerida; é possível adicionar um **budget type** (valor administrativo), gerido em **Setup > Dropdowns > Types > Budget types**. Suporta *template*.

> [!quote] budgets.rst · abas
> Aba **Main tab**: tabela-resumo com o valor gasto do orçamento, ordenado por tipo de item, e o total restante; NÃO é possível adicionar custo diretamente aqui — os custos são deduzidos pelas abas de mesmo nome nos diversos objetos GLPI (changes, tickets, etc.). Aba **Items**: exibe os itens GLPI anexados a este orçamento e seus valores. Inclui abas Documents, Knowledgebase, External links, Notes, Historical, All.

## Sustenta
- [[Orçamento na interface (Budget) — visão do usuário]]
- [[Gestão Financeira via Orçamentos (visão do usuário)]]
- [[Campos do formulário de Orçamento]]
- [[Vincular um item a um orçamento (procedimento)]]
