---
title: Dropdowns de calendário e períodos de fechamento
aliases: [Calendar, Close times, Time ranges, Períodos de fechamento]
tags: [dropdown, calendar, sla, closing-periods, entity]
type: component
status: confirmed
source: "[[EV-2-f2-008 · Dropdowns de calendário e períodos de fechamento|EV-2-f2-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Dropdowns de calendário e períodos de fechamento

Os **calendários** definem os horários de trabalho usados no cálculo de prazos. Categoria de [[Catálogo de tipos de dropdown (configuração)]].

## Calendar
Configurável **por entidade**, caracterizado por períodos de abertura e de fechamento. Usado nos **SLA** (ver [[SLA e níveis de serviço (regra)]], [[SLM, SLA e OLA]]) e na configuração de entidades ([[Modelo de Entidades (multi-tenancy)]]). Abas:
- **Time ranges** — faixas de horário de abertura da entidade; várias por dia desde que não se sobreponham.
- **Close times** — períodos de fechamento atribuídos ao calendário.

## Close times (períodos de fechamento)
Lista **plana**, delegável por entidade. Um período consiste de **nome, período e recorrência**. Se **Recorrente = Sim**, o período vale o tempo todo e o GLPI ignora o ano indicado — útil para feriados anuais (Natal, 1º de maio) ou fechamento anual da empresa, evitando reinserir as datas todo ano.

> [!note]
> Os períodos de abertura/fechamento afetam diretamente os cálculos de [[TTO e TTR (indicadores de tempo)]] e o cumprimento de prazos de SLA.
