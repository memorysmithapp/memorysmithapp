---
title: Ciclo de vida de um Ticket (máquina de estados)
aliases: [Máquina de estados do Ticket, status ticket]
tags: [state-machine, itil, dominio/service-desk]
type: state-machine
maturity: evergreen
reviewed: false
source: "[[EV-1-008 · CommonITILObject define statuses e matriz de prioridade|EV-1-008]]"
author: CAD Discovery
created: 2026-07-10
---

# Ciclo de vida de um Ticket (máquina de estados)

Os estados de um [[Ticket]] são os do [[CommonITILObject (base de service desk)]]. **O
conjunto de transições permitidas não é hard-coded**: é uma **matriz por perfil**
(`glpiactiveprofile['ticket_status'][old][new]`), resolvida por `isAllowedStatus()`
([[EV-1-008 · CommonITILObject define statuses e matriz de prioridade|EV-1-008]]). Ou seja, cada organização/perfil pode restringir quem move o quê.

## Estados
`INCOMING(1)` novo · `ASSIGNED(2)` atribuído · `PLANNED(3)` planejado ·
`WAITING(4)` pendente · `SOLVED(5)` solucionado · `CLOSED(6)` fechado.
(APPROVAL/ACCEPTED/OBSERVED aparecem conforme configuração.)

```mermaid
stateDiagram-v2
    [*] --> INCOMING
    INCOMING --> ASSIGNED
    ASSIGNED --> PLANNED
    ASSIGNED --> WAITING
    PLANNED --> WAITING
    WAITING --> ASSIGNED
    ASSIGNED --> SOLVED
    PLANNED --> SOLVED
    SOLVED --> CLOSED
    SOLVED --> ASSIGNED: reaberto
    CLOSED --> [*]
```

> [!warning] Transições configuráveis
> O diagrama acima é o fluxo **típico**; a instância pode permitir/proibir arestas por perfil.
> Ver [[INV-1-005 · Regras exatas de transição de status por perfil]]. Diagrama em
> [[Máquina de estados do Ticket (view)]].
