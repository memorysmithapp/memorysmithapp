---
title: INV-2-b2-002 · Valores exatos da matriz de prioridade default
aliases: [INV-2-b2-002]
tags: [investigation, consumidor/cad, prioridade, matriz]
type: investigation
status: open
maturity: seed
reviewed: false
source: "[[EV-2-b2-005 · Matriz de cálculo de prioridade (urgência × impacto)|EV-2-b2-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# INV-2-b2-002 · Valores exatos da matriz de prioridade default

> [!question] Pergunta aberta
> Quais os **valores exatos** da matriz de prioridade predefinida (5 níveis de urgência × 5 de
> impacto → prioridade resultante)? O texto do doc explica o conceito e as regras de
> ativação/desativação de níveis, mas a matriz numérica está **apenas** na captura de tela
> `images/priority_matrix.png`.

> [!note] Ponte com o código
> O algoritmo de cálculo (`computePriority`, matriz configurável em `CFG_GLPI`) está descrito
> em [[EV-1-008 · CommonITILObject define statuses e matriz de prioridade|EV-1-008]]; falta o
> conteúdo default da matriz de configuração.

Base: [[Matriz de prioridade (configuração urgência × impacto)]].
