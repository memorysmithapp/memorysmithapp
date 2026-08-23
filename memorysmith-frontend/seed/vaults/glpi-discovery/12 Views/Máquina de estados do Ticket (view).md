---
title: Máquina de estados do Ticket (view)
aliases: [State diagram ticket]
tags: [view, state-machine, dominio/service-desk]
type: view
status: confirmed
source: "[[EV-1-008 · CommonITILObject define statuses e matriz de prioridade|EV-1-008]]"
author: CAD Discovery
created: 2026-07-10
---

# Máquina de estados do Ticket (view)

Deriva de [[Ciclo de vida de um Ticket (máquina de estados)]]. Transições sujeitas à matriz
por perfil.

```mermaid
stateDiagram-v2
    [*] --> INCOMING: abertura
    INCOMING --> ASSIGNED: atribuição
    INCOMING --> WAITING
    ASSIGNED --> PLANNED: agendamento
    ASSIGNED --> WAITING: pendência
    PLANNED --> WAITING
    WAITING --> ASSIGNED: retomada
    PLANNED --> SOLVED: solução
    ASSIGNED --> SOLVED: solução
    SOLVED --> CLOSED: fechamento
    SOLVED --> ASSIGNED: reabertura
    CLOSED --> [*]
```
