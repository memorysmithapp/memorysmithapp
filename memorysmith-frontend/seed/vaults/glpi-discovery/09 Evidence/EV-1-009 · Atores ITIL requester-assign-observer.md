---
title: EV-1-009 · Atores ITIL (requester/assign/observer)
aliases: [EV-1-009]
tags: [evidence, dominio/service-desk, atores]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-001 · src/CommonITILActor.php L39–48 · src/Ticket.php L66–68"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-009 · Atores ITIL (requester/assign/observer)

> [!quote] `src/CommonITILActor.php` (L39–48)
> ```php
> abstract class CommonITILActor extends CommonDBRelation {
>     public const REQUESTER = 1;  // solicitante
>     public const ASSIGN    = 2;  // atribuído (técnico/grupo/fornecedor)
>     public const OBSERVER  = 3;  // observador
> }
> ```

> [!quote] `src/Ticket.php` (L66–68)
> ```php
> public $userlinkclass     = Ticket_User::class;
> public $grouplinkclass    = Group_Ticket::class;
> public $supplierlinkclass = Supplier_Ticket::class;
> ```

Cada objeto ITIL relaciona-se com **atores** em três papéis (requester/assign/observer),
e cada papel pode ser preenchido por **usuário**, **grupo** ou **fornecedor** — via classes
de ligação dedicadas (`Ticket_User`, `Group_Ticket`, `Supplier_Ticket`, e equivalentes de
Change/Problem). O papel é guardado no campo `type` da linha de ligação.

## Sustenta
- [[Modelo de Atores ITIL]]
- [[Gestão de Incidentes e Requisições (processo)]]
