---
title: EV-2-b1-005 · Ciclo de vida do ticket (tipos, status, priorização, regras)
aliases: [EV-2-b1-005]
tags: [evidence, assistance, ticket, lifecycle, status, priority, itil]
type: evidence
status: confirmed
source: "SRC-002 · source/modules/assistance/tickets/ticketlifecycle.rst · Ticket life cycle"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-b1-005 · Ciclo de vida do ticket (tipos, status, priorização, regras)

> [!quote] ticketlifecycle.rst — nível de perfil
> O ciclo de vida do ticket é definido a **nível de perfil** numa *matriz de ciclo de vida* (menu **Administration > Profiles**).

> [!quote] ticketlifecycle.rst — "Ticket types"
> Tickets do GLPI são **incidents** ou **requests**, tipo armazenado no campo *Type*. O tipo permite executar ações baseadas nele (regras de negócio, templates, gestão de problemas) e customizar a lista de categorias disponíveis.

> [!quote] ticketlifecycle.rst — "Status"
> O ITIL define um padrão para o ciclo de status. O GLPI implementa os status: **New**, **Processing (assigned)**, **Processing (planned)**, **Pending**, **Solved**, **Closed**. Esses status **não podem ser parametrizados nem modificados**. É possível ocultar alguns status conforme o perfil (via matriz de ciclo de vida).

> [!quote] ticketlifecycle.rst — "Scheduling"
> O agendamento é feito segundo dados do requerente e do técnico: o **requerente define a urgência**; o **técnico avalia o impacto**. A **prioridade** resulta dos dois valores, calculada automaticamente por uma matriz.

> [!quote] ticketlifecycle.rst — "Management rules"
> Processo de status:
> - na criação, o ticket tem status **New**;
> - quando o técnico atribui o processamento a um grupo, técnico ou fornecedor → **Processing (assigned)**;
> - quando uma nova tarefa é adicionada e planejada → **Processing (planned)**;
> - quando uma solução é encontrada → **Solved**;
> - quando o requerente ou redator valida a solução proposta → **Closed**.
> Notas: o técnico pode mudar o status a qualquer momento, em particular para **Pending**; seguindo o ITIL, um ticket só deve ser posto em Pending pelo requerente (ex.: pedido incompleto ou requerente indisponível). O **requerente pode excluir o ticket** enquanto o status for **New** e nenhuma ação tiver sido feita.

## Sustenta
- [[Ciclo de vida do ticket (visão do usuário)]]
- [[Campos do formulário de Ticket]]
