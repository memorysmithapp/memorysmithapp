---
title: EV-2-b1-009 · Campos do ticket recorrente
aliases: [EV-2-b1-009]
tags: [evidence, assistance, ticket, recurrent, fields, crontask]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · source/modules/assistance/tickets/recurrentticket.rst · Reccurent tickets"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-b1-009 · Campos do ticket recorrente

> [!quote] recurrentticket.rst — "Reccurent tickets"
> Usando templates, é possível programar a abertura recorrente de tickets. Exemplos: abrir um ticket toda segunda para checar o backup do fim de semana; abrir um ticket no primeiro dia do mês para operações de inicialização.

> [!quote] recurrentticket.rst — "The different fields"
> - **Active**: permite desabilitar temporariamente a criação do ticket;
> - **Ticket template**: modelo usado para a criação do ticket;
> - **Start date**: data de início da criação, obrigatória;
> - **End date**: opcional, define a data de fim da criação;
> - **Periodicity**: período de criação do ticket;
> - **Preliminary creation**: tempo de antecipação da criação do ticket;
> - **Calendar**: permite limitar os dias de criação do ticket.
> Nota: tickets só são criados se `Active` = `Yes` e a data atual estiver entre `Start date` e `End date`.

> [!quote] recurrentticket.rst — automação
> A abertura recorrente é feita por uma ação automática chamada *recurrent ticket* (ver configuração de ações automáticas / crontasks).

## Sustenta
- [[Campos do Ticket Recorrente]]
- [[Tickets recorrentes (fluxo)]]
