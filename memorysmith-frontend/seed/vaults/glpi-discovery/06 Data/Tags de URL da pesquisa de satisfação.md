---
title: Tags de URL da pesquisa de satisfação
aliases: [Survey URL tags]
tags: [entidades, satisfacao, tags, url, dados, doc]
type: table
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-e2-005 · Entidade - aba Assistência (templates, fechamento, satisfação)|EV-2-e2-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Para pesquisas de satisfação **externas**, a URL pode ser gerada automaticamente substituindo as tags abaixo (aba Assistance da entidade).

| Tag | Significado |
|---|---|
| `[TICKET_ID]` | ID do ticket |
| `[TICKET_NAME]` | Nome do ticket |
| `[TICKET_CREATEDATE]` | Data de criação |
| `[TICKET_SOLVEDATE]` | Data de resolução |
| `[TICKET_PRIORITY]` | ID da prioridade |
| `[TICKET_PRIORITYNAME]` | Nome da prioridade |
| `[ITILCATEGORY]` / `[ITILCATEGORY_NAME]` | Categoria ITIL (ID/nome) |
| `[SOLUTIONTYPE_ID]` / `[SOLUTIONTYPE_NAME]` | Tipo de solução (ID/nome) |
| `[REQUESTTYPE_ID]` / `[REQUESTTYPE_NAME]` | Fonte da requisição (ID/nome) |
| `[TICKETTYPE_ID]` / `[TICKETTYPE_NAME]` | Tipo do ticket (incidente/requisição) |
| `[SLA_TTO_ID]` / `[SLA_TTO_NAME]` | Time To Own (ID/nome) |
| `[SLA_TTR_ID]` / `[SLA_TTR_NAME]` | Time To Resolve (ID/nome) |
| `[SLALEVEL_ID]` / `[SLALEVEL_NAME]` | Nível de SLA (ID/nome) |

Ver [[Pesquisa de satisfação (fluxo)]] e [[TTO e TTR (indicadores de tempo)]].
