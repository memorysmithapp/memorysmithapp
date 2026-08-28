---
title: SLM, SLA e OLA
aliases: [SLM, SLA, OLA, Service Level]
tags: [component, sla, dominio/service-desk]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-1-011 · SLM SLA e OLA com TTR-TTO e níveis de escalonamento|EV-1-011]]"
author: CAD Discovery
created: 2026-07-10
---

# SLM, SLA e OLA

O GLPI gerencia níveis de serviço numa hierarquia de três peças:

- **SLM** (`SLM`, *Service Level Management*) — o **contêiner** que agrupa acordos e define os
  tipos de prazo: **TTR** (Time To Resolve = 0) e **TTO** (Time To Own = 1).
- **SLA** (`SLA extends LevelAgreement`) — acordo com o **cliente/solicitante**.
- **OLA** (`OLA extends LevelAgreement`) — acordo **operacional interno** (entre times).
- **SlaLevel / OlaLevel** — **níveis de escalonamento**: ações disparadas em pontos do prazo
  (ex.: notificar gestor a 80% do TTR, reatribuir ao violar).

## Cálculo de prazo
Os prazos são calculados em **horas úteis** conforme o [[Calendário de trabalho e feriados]]
(um SLA pode contar 4h úteis, respeitando expediente/feriados). Um Ticket referencia
`slas_id_ttr`, `slas_id_tto`, `olas_id_ttr`, `olas_id_tto` e guarda os `*_time_to_*` calculados.

## Regra de negócio associada
Ver [[SLA e níveis de serviço (regra)]].

> [!question]
> O que exatamente cada nível de escalonamento pode disparar (notificação, mudança de
> campo, reatribuição)? Ver [[INV-1-004 · Ações de escalonamento de SLA]].
