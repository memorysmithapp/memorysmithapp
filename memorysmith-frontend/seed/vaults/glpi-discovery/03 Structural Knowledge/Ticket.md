---
title: Ticket
aliases: [Chamado, Ticket]
tags: [entity, itil, dominio/service-desk]
type: entity
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-010 · Ticket com tipos incidente-requisição e direitos específicos|EV-1-010]]"
  - "[[EV-1-008 · CommonITILObject define statuses e matriz de prioridade|EV-1-008]]"
author: CAD Discovery
created: 2026-07-10
---

# Ticket

O **Ticket** (chamado) é o objeto central do service desk do dia a dia — subclasse de
[[CommonITILObject (base de service desk)]]. Cobre dois processos ITIL distintos pelo campo
**type**: **incidente** (`INCIDENT_TYPE=1`) e **requisição de serviço** (`DEMAND_TYPE=2`).

## Características
- `dohistory = true` (auditoria completa via [[Log e histórico de auditoria]]).
- Atores via `Ticket_User` / `Group_Ticket` / `Supplier_Ticket` — ver [[Modelo de Atores ITIL]].
- Direitos granulares: `ASSIGN`, `STEAL`, `OWN`, `CHANGEPRIORITY`, `READASSIGN`, `READGROUP`.
- Encaminha a entidade a `TicketValidation` e `TicketCost` (`forward_entity_to`).
- `userentity_oncreate = true` → entidade herdada do solicitante na criação.
- Objetos associados: [[SLM, SLA e OLA]], [[Categorias e templates ITIL]], satisfação
  (`TicketSatisfaction`), custos (`TicketCost`), followups/tasks/solução.

## Processos
- [[Gestão de Incidentes e Requisições (processo)]]
- Máquina de estados em [[Ciclo de vida de um Ticket (máquina de estados)]].
