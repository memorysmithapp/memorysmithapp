---
title: Campos do Ticket Recorrente
aliases: [Campos do recurrent ticket]
tags: [assistance, ticket, recurrent, fields, data]
type: table
maturity: evergreen
reviewed: false
source: "[[EV-2-b1-009 · Campos do ticket recorrente|EV-2-b1-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos do Ticket Recorrente

Parâmetros do formulário de ticket recorrente:

| Campo | Semântica |
|-------|-----------|
| **Active** | Habilita/desabilita temporariamente a criação do ticket. |
| **Ticket template** | Modelo usado para a criação. Ver [[Templates de tickets]]. |
| **Start date** | Data de início da criação — **obrigatória**. |
| **End date** | Data de fim (opcional). |
| **Periodicity** | Período de criação do ticket. |
| **Preliminary creation** | Tempo de antecipação da criação. |
| **Calendar** | Limita os dias de criação. |

> [!note] Condição de criação
> Tickets só são criados se `Active = Yes` e a data atual estiver entre `Start date` e `End date`.

## Ver também
- [[Tickets recorrentes (fluxo)]] · [[Ações Automáticas (CronTask)]] (código)
