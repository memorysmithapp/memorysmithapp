---
title: Modelo de dados do Service Desk (view)
aliases: [ER service desk, modelo ITIL]
tags: [view, itil, dados, dominio/service-desk]
type: view
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-008 · CommonITILObject define statuses e matriz de prioridade|EV-1-008]]"
  - "[[EV-1-009 · Atores ITIL requester-assign-observer|EV-1-009]]"
  - "[[EV-1-011 · SLM SLA e OLA com TTR-TTO e níveis de escalonamento|EV-1-011]]"
  - "[[EV-1-012 · Validação ITIL e artefatos filhos followup-task-solution|EV-1-012]]"
author: CAD Discovery
created: 2026-07-10
---

# Modelo de dados do Service Desk (view)

Relações centrais em torno do [[CommonITILObject (base de service desk)]] (usando Ticket
como exemplo).

```mermaid
erDiagram
    TICKET ||--o{ TICKET_USER : atores
    TICKET ||--o{ GROUP_TICKET : grupos
    TICKET ||--o{ SUPPLIER_TICKET : fornecedores
    TICKET ||--o{ ITILFOLLOWUP : followups
    TICKET ||--o{ TICKETTASK : tarefas
    TICKET ||--o| ITILSOLUTION : solucao
    TICKET ||--o{ TICKETVALIDATION : validacoes
    TICKET ||--o| TICKETSATISFACTION : satisfacao
    TICKET }o--|| ITILCATEGORY : categoria
    TICKET }o--o| TICKETTEMPLATE : template
    TICKET }o--o| SLA : sla_ttr_tto
    TICKET }o--o| OLA : ola_ttr_tto
    SLM ||--o{ SLA : contem
    SLM ||--o{ OLA : contem
    SLA ||--o{ SLALEVEL : escalonamento
    TICKET }o--o{ CHANGE : Change_Ticket
    TICKET }o--o{ PROBLEM : Problem_Ticket
```
