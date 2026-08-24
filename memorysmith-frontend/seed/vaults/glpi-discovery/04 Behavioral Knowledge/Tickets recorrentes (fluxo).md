---
title: Tickets recorrentes (fluxo)
aliases: [Recurrent tickets, Chamados recorrentes]
tags: [assistance, ticket, recurrent, automation, crontask, template]
type: flow
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-b1-009 · Campos do ticket recorrente|EV-2-b1-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Tickets recorrentes (fluxo)

Usando [[Templates de tickets|templates]], é possível programar a **abertura recorrente** de chamados — por exemplo, abrir um ticket toda segunda para checar o backup do fim de semana, ou no primeiro dia do mês para operações de inicialização.

A criação é executada por uma **ação automática** chamada *recurrent ticket* (ver [[Ações Automáticas (CronTask)]]). Um ticket recorrente só gera chamados se `Active = Yes` e se a data atual estiver entre `Start date` e `End date`.

Ver os parâmetros em [[Campos do Ticket Recorrente]].

## Ver também (código)
- [[Ações Automáticas (CronTask)]] · [[Ticket]]
