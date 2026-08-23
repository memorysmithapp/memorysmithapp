---
title: EV-1-010 · Ticket com tipos incidente/requisição e direitos específicos
aliases: [EV-1-010]
tags: [evidence, dominio/service-desk, ticket]
type: evidence
status: confirmed
source: "SRC-001 · src/Ticket.php · L59–105, 158–164"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-010 · Ticket com tipos incidente/requisição e direitos específicos

> [!quote] `src/Ticket.php`
> ```php
> class Ticket extends CommonITILObject implements DefaultSearchRequestInterface {
>     public $dohistory = true;
>     protected static $forward_entity_to = [TicketValidation::class, TicketCost::class];
>     public $userlinkclass = Ticket_User::class; /* + Group_Ticket, Supplier_Ticket */
>     public static $rightname = 'ticket';
>     protected $userentity_oncreate = true;
>
>     // Tipos de chamado
>     public const INCIDENT_TYPE = 1;   // incidente
>     public const DEMAND_TYPE   = 2;   // requisição de serviço
>
>     // Direitos específicos (além de READ/UPDATE/CREATE...)
>     const READGROUP=2048; const READASSIGN=4096; const ASSIGN=8192;
>     const STEAL=16384; const OWN=32768; const CHANGEPRIORITY=65536; const READNEWTICKET=262144;
> }
> // canAssign(): bloqueia atribuição em ticket fechado (L158–164)
> ```

O **Ticket** distingue **incidente** (`INCIDENT_TYPE`) de **requisição de serviço**
(`DEMAND_TYPE`) — a base ITIL de Incident Management vs Request Fulfillment. Direitos
granulares (`ASSIGN`, `STEAL`, `OWN`, `CHANGEPRIORITY`, `READASSIGN`, `READGROUP`) refinam o
[[Perfis e Direitos (RBAC)]] para o service desk. `userentity_oncreate` fixa a entidade pelo
solicitante.

## Sustenta
- [[Gestão de Incidentes e Requisições (processo)]]
- [[Ticket]]
