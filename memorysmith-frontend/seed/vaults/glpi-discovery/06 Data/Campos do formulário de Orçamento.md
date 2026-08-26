---
title: Campos do formulário de Orçamento
aliases: [Budget fields]
tags: [data, management, budget, financial, fields, doc]
type: table
maturity: evergreen
reviewed: false
source: "[[EV-2-d1-005 · Orçamentos — definição, criação e abas|EV-2-d1-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos do formulário de Orçamento

O [[Orçamento na interface (Budget) — visão do usuário|orçamento]] é definido essencialmente por:

| Campo | Semântica |
|-------|-----------|
| **Value / Amount** | Montante do orçamento; base do cálculo do saldo restante. |
| **Time period** | Período de tempo (datas início/fim) de validade do orçamento. |
| **Budget type** | Valor administrativo (dropdown), gerido em *Setup > Dropdowns > Types > Budget types*. |

> [!note]
> O doc descreve o orçamento como "defined by an amount and a time period" e destaca o *budget type* como valor administrativo, sem enumerar exaustivamente os demais campos do formulário. Os valores dos itens anexados (que reduzem o saldo) provêm de cada item, pela sua aba `Management`, não são digitados no orçamento.

O saldo restante pode ser **negativo** e não é exibido quando o orçamento pertence a uma subentidade.

> [!note] Ponte doc×código
> Entidade [[Orçamentos e Custos]]; camada financeira [[Infocom (dados financeiros do ativo)]].
