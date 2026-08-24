---
title: Vincular um item a um orçamento (procedimento)
aliases: [Attach item to budget]
tags: [use-case, management, budget, financial, doc]
type: use-case
maturity: evergreen
reviewed: false
source: "[[EV-2-d1-005 · Orçamentos — definição, criação e abas|EV-2-d1-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Vincular um item a um orçamento (procedimento)

> [!warning] Ponto-chave
> "Attaching a GLPI item to a budget is done via tab `Management` of the item!" — o vínculo **não** é feito na tela do [[Orçamento na interface (Budget) — visão do usuário|orçamento]], e sim na **aba `Management` do próprio item** (ativo, contrato, ticket, etc.).

Fluxo:

1. Abrir o item GLPI desejado.
2. Ir à aba **Management** do item.
3. Selecionar o orçamento a que o item deve ser imputado (e informar o valor).
4. O item passa a aparecer na aba **Items** do orçamento, com o seu valor, reduzindo o saldo restante.

Na tela do orçamento, a **Main tab** apenas resume o gasto por tipo de item; **não é possível lançar custos diretamente** ali.

> [!note] Ponte doc×código
> A aba Management corresponde a [[Infocom (dados financeiros do ativo)]]; o orçamento a [[Orçamentos e Custos]].
