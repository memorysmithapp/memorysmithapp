---
title: EV-2-b1-006 · Campos específicos do formulário de ticket
aliases: [EV-2-b1-006]
tags: [evidence, assistance, ticket, fields, form, data]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · source/modules/assistance/tickets/ticketmanagement.rst · Description of specific fields"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-b1-006 · Campos específicos do formulário de ticket

> [!quote] ticketmanagement.rst — "Description of specific fields"
> - **Opening date**: data de criação do ticket;
> - **Time to Resolve**: data em que o ticket deve ser resolvido; junto com Opening date limitam no tempo o incidente/requisição; um **SLA** pode ser associado (exibe SLA e próximo nível de escalada);
> - **By**: usuário GLPI que abriu o ticket;
> - **Type**: define se é request ou incident;
> - **Category**: classifica por natureza; uma categoria é associada a apenas um tipo;
> - **Status**: atribuído manualmente pelo técnico ou dinamicamente por ações realizadas;
> - **Request Source**: canal usado para criar o ticket (dropdown configurável);
> - **Urgency**: importância dada pelo requerente;
> - **Impact**: importância dada pelo técnico;
> - **Priority**: importância calculada automaticamente a partir de impacto e urgência via matriz;
> - **Approval**: por padrão o ticket é *Not subject to approval*;
> - **Items**: itens associados; campo aparece só no formulário de criação, edições posteriores exibem itens em aba separada;
> - **Location**: local da intervenção, sem ligação com o local dos itens associados nem com o local do requerente;
> - **Actor**: atores implicados são referenciados no ticket, o que permite notificá-los; se followups por e-mail configurados, exibe *Email Followup* (sim/não) e *Email* (pré-preenchido, ou digitável);
> - **Title**: se nenhum título é definido, os primeiros 70 caracteres da descrição são usados;
> - **Description**: obrigatório;
> - **Linked Tickets**: vínculo entre tickets, de dois tipos — *Linked to* (link informativo simples) e *Duplicates* (ao resolver um duplicado, a mesma solução é aplicada aos demais, resolvidos automaticamente).

> [!note] ticketmanagement.rst — multi-entidade
> Com múltiplas entidades e técnicos autorizados em várias, não é preciso trocar a entidade atual para declarar um incidente: o técnico seleciona o requerente e o GLPI encontra as entidades autorizadas para ele; se só uma, o ticket é declarado nela; se várias, uma lista suspensa permite escolher.

> [!todo] Lacunas no próprio doc
> O doc marca `.. todo::` para: revisar o parágrafo multi-entidade e descrever os vínculos *Son of* e *Parent of* de Linked Tickets (ausentes).

## Sustenta
- [[Campos do formulário de Ticket]]
- [[Vínculos entre tickets]]
