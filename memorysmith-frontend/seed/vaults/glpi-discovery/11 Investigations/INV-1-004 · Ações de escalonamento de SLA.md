---
title: INV-1-004 · Ações de escalonamento de SLA
aliases: [INV-1-004]
tags: [investigation, consumidor/cad, sla]
type: investigation
status: open
maturity: seed
reviewed: false
source: "[[EV-1-011 · SLM SLA e OLA com TTR-TTO e níveis de escalonamento|EV-1-011]]"
author: CAD Discovery
created: 2026-07-10
---

# INV-1-004 · Ações de escalonamento de SLA

> [!question] Pergunta aberta
> Que ações concretas um `SlaLevel`/`OlaLevel` pode disparar ao atingir um marco do prazo?
> (notificação, mudança de campo, reatribuição, mudança de status?) E como o "criteria" do
> nível é avaliado e agendado (cron)?

> [!note] Progresso (Módulo 6)
> Confirmado que o **disparo** é uma [[Ações Automáticas (CronTask)|CronTask]] de
> escalonamento que avalia os níveis por prazo. Falta enumerar o **catálogo de ações** que um
> `SlaLevel`/`OlaLevel` executa (usa o mesmo mecanismo de [[Tipos de Regra|regras]]:
> critérios + ações). Mantida **aberta** até enumerar as ações.

Relaciona-se ao Módulo 6 (jobs/cron). Base: [[SLM, SLA e OLA]], [[Ações Automáticas (CronTask)]].
