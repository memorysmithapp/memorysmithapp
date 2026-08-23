---
title: SLA e níveis de serviço (regra)
aliases: [SLA regra, TTR TTO]
tags: [rule, sla, dominio/service-desk]
type: rule
status: confirmed
source: "[[EV-1-011 · SLM SLA e OLA com TTR-TTO e níveis de escalonamento|EV-1-011]]"
author: CAD Discovery
created: 2026-07-10
---

# SLA e níveis de serviço (regra)

> [!note] Regra
> Cada chamado pode ter prazos de **TTO** (tempo para ser assumido) e **TTR** (tempo para
> ser resolvido), definidos por um **SLA** (com o cliente) e/ou **OLA** (interno). Os prazos
> são calculados em **horas úteis** segundo o [[Calendário de trabalho e feriados]].

- O SLA aplicável costuma ser determinado por regras (categoria, prioridade, entidade).
- Ao atingir marcos do prazo, **níveis de escalonamento** (`SlaLevel`/`OlaLevel`) disparam
  ações (ver [[INV-1-004 · Ações de escalonamento de SLA]]).
- O objeto guarda o instante-limite calculado e sinaliza **violação** quando o prazo passa
  sem resolução/atribuição.

Estrutura de suporte em [[SLM, SLA e OLA]].
