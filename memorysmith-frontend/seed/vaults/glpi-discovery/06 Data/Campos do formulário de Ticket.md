---
title: Campos do formulário de Ticket
aliases: [Campos do ticket, Ticket fields]
tags: [assistance, ticket, fields, form, data]
type: table
maturity: evergreen
reviewed: false
source: "[[EV-2-b1-006 · Campos específicos do formulário de ticket|EV-2-b1-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos do formulário de Ticket

Campos específicos descritos na documentação do formulário de chamado:

| Campo | Semântica |
|-------|-----------|
| **Opening date** | Data de criação do ticket. |
| **Time to Resolve** | Data em que o ticket deve ser resolvido; junto com Opening date limita o incidente/requisição no tempo. Pode associar um [[SLA e níveis de serviço (regra)|SLA]] (exibe SLA e próximo nível de escalada). |
| **By** | Usuário GLPI que abriu o ticket. |
| **Type** | Request ou incident. |
| **Category** | Classifica por natureza; uma categoria pertence a **um único tipo**. Ver [[Categorias ITIL de chamados]]. |
| **Status** | Atribuído manualmente pelo técnico ou dinamicamente por ações. Ver [[Ciclo de vida do ticket (visão do usuário)]]. |
| **Request Source** | Canal usado para criar o ticket ([[Dropdown (lista suspensa customizável)|dropdown]] configurável). |
| **Urgency** | Importância dada pelo **requerente**. |
| **Impact** | Importância dada pelo **técnico**. |
| **Priority** | Calculada automaticamente de urgência × impacto via matriz. Ver [[Priorização (urgência × impacto)]]. |
| **Approval** | Por padrão, *Not subject to approval*. Ver [[Validação e aprovação (regra)]]. |
| **Items** | Itens associados; campo só no formulário de criação (edições exibem em aba separada). |
| **Location** | Local da intervenção; independente do local dos itens ou do requerente. |
| **Actor** | Atores implicados, referenciados para notificação. Exibe *Email Followup* e *Email* se followups por e-mail estão configurados. Ver [[Atores e papéis de um chamado (visão do usuário)]]. |
| **Title** | Se vazio, usa os primeiros **70 caracteres** da descrição. |
| **Description** | **Obrigatório**. |
| **Linked Tickets** | Vínculos *Linked to* / *Duplicates*. Ver [[Vínculos entre tickets]]. |

> [!note] Multi-entidade
> Com técnicos autorizados em várias entidades, não é preciso trocar a entidade atual: ao selecionar o requerente, o GLPI determina a entidade (única → automática; várias → lista suspensa).

## Ver também (código)
- [[Ticket]] · [[CommonITILObject (base de service desk)]]
