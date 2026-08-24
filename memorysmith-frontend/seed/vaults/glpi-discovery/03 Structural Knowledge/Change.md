---
title: Change
aliases: [Mudança, Change]
tags: [entity, itil, dominio/service-desk]
type: entity
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-1-013 · Change e Problem estendem CommonITILObject com fases próprias|EV-1-013]]"
author: CAD Discovery
created: 2026-07-10
---

# Change

A **Change** (mudança) modela a gestão de mudanças ITIL — subclasse de
[[CommonITILObject (base de service desk)]] com `STATUS_MATRIX_FIELD = 'change_status'`.

Além dos statuses comuns, acrescenta as **fases de mudança**: **EVALUATION (9)**,
**APPROVAL (10)**, **TEST (11)**, **QUALIFICATION (12)**, além de **REFUSED (13)** e
**CANCELED (14)** — refletindo o fluxo planejar → aprovar → testar → qualificar.

Reaproveita atores, timeline, validação (`ChangeValidation`), custos (`ChangeCost`),
tarefas (`ChangeTask`) e templates (`ChangeTemplate`). Liga-se a Tickets e Problems
(`Change_Ticket`, `Change_Problem`) — a cadeia incidente → problema → mudança.

Ver [[Gestão de Mudanças (processo)]].
