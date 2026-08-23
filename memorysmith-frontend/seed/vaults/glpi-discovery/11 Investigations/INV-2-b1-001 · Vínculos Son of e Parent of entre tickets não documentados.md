---
title: INV-2-b1-001 · Vínculos Son of e Parent of entre tickets não documentados
aliases: [INV-2-b1-001]
tags: [investigation, consumidor/cad, assistance, ticket, links]
type: investigation
status: open
author: CAD Discovery (doc)
created: 2026-07-12
---

# INV-2-b1-001 · Vínculos Son of e Parent of entre tickets não documentados

> [!question] Lacuna na documentação oficial
> Em `source/modules/assistance/tickets/ticketmanagement.rst`, a seção **Linked Tickets** descreve apenas os vínculos *Linked to* e *Duplicates*. Um bloco `.. todo::` explícito registra: *"Missing description of Son of and Parent of"*.

Os tipos de vínculo **Son of** (filho de) e **Parent of** (pai de) existem no produto mas não têm semântica descrita no doc do usuário. É preciso confirmar, contra o código ([[Ticket]] / relação `Ticket_Ticket`), o comportamento desses vínculos (ex.: propagação de status/solução, hierarquia pai-filho).

## Relacionado
- [[Vínculos entre tickets]]
