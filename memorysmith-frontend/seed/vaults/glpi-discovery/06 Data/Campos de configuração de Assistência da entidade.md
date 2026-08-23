---
title: Campos de configuração de Assistência da entidade
aliases: [Entity assistance fields]
tags: [entidades, campos, assistencia, tickets, satisfacao, dados, doc]
type: table
status: confirmed
source: "[[EV-2-e2-005 · Entidade - aba Assistência (templates, fechamento, satisfação)|EV-2-e2-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Campos da aba **Assistance** de uma entidade (visível com autorização *Read/Modify Entity Parameters*).

## Templates
- **Ticket template** / **Change template** / **Problem template** (aplicados a cada criação) — ver [[Templates de tickets]].

## Tickets
- **Calendar** (cálculo de tempo de resolução; pré-selecionado ao criar SLA) — ver [[SLM, SLA e OLA]];
- **Ticket Default Type** (útil na criação via coletor de e-mail);
- **Automatic assignment**: No / *based on item then on category* / *based on category then on item*;
- **Mark supplier followup (via email collector) as private**: No/Yes/Herança;
- **Anonymize support agents**: várias opções (genérico ou apelido customizável; agente e/ou grupo);
- **Display initials for users without picture**: No/Yes/Herança;
- **Default contract**: Herança / Contact in ticket entity.

## Automatic closing
- **Automatic closing of solved ticket after** (never..365 dias; se *immediately*, bloqueia aprovação da solução) — ver [[Fechamento automático e administrativo de tickets]];
- **Automatic purge of closed tickets after** (never..365 dias; requer ação `purgeticket`).

## Satisfaction survey
- **Configuring the satisfaction survey**: External/Internal (external exibe URL);
- **Create survey after** (0..90 dias); **Rate to trigger survey** (Disabled..100%); **Duration of survey**; **Max rate** (1..10); **Default rate**; **Comment required if score <=** (1..10); **For tickets closed after** (data de ativação).
- URL externa pode ser gerada com tags — ver [[Tags de URL da pesquisa de satisfação]] e [[Pesquisa de satisfação (fluxo)]].

## Helpdesk
- **Show tickets properties on helpdesk** (exibir info a perfis self-service).
