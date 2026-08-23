---
title: Aba Assistance de Perfil (direitos de service desk)
aliases: [Assistance tab, Aba Assistance, Direitos de assistência]
tags: [perfis, permissoes, assistance, tickets, followups, tasks, validacao, planning]
type: component
status: confirmed
source: "[[EV-2-e1-006 · Aba Assistance do perfil (direitos de service desk, simplificada e padrão)|EV-2-e1-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Aba Assistance de Perfil (direitos de service desk)

Aba do perfil que gere as permissões sobre **tickets, follow-ups, tarefas, validações, associações, problemas e mudanças**, além da visibilidade de estatísticas e agendas e da atribuição de template ao perfil. Os direitos diferem entre a [[Interface Simplificada (Helpdesk-Self-Service)|interface simplificada]] e a [[Interface Padrão (Standard)|padrão]].

## Interface simplificada
- **Tickets**: *See My Ticket* (autor/requerente/observador + follow-ups públicos); *Create* (adiciona menu Create Ticket); *See Group Ticket* (tickets com meus grupos como requerente/observador).
- **Followups**: *See Public Ones*; *Update followups (author)*; *Add followup (requester)* (também anexa documento); *Add followup (associated groups)*.
- **Tasks**: *See Public Ones* (também exibe a aba Tasks).
- **Validations**: *Validate an Incident*; *Validate a Request*; *Create for Request*; *Create for Incident*. A aba *Validation* aparece conforme os direitos e o tipo do ticket.
- **Associations**: *Link with items* (My Devices / All Items); *Associable items to a ticket* (tipos de ativo; All/None); *Default ITIL templates* (Ticket/Change/Problem — só templates recursivos da entidade raiz); *See hardware of my groups*.

## Interface padrão
- **Tickets**: *Assigned Tickets*; *Steal* (roubar o ticket); *Change the Priority* (cancela cálculo automático); *See All Tickets*; *See Assigned*; *Assign* (técnico/grupo/fornecedor).
- **Followups**: *See Private Ones*; *Update All* (técnico atribuído/membro do grupo também modifica todos); *Add to all tickets*.
- **Tasks**: *See Private Ones*; *Update All*; *Add to all tickets*.
- **Planning**: *See personal planning*; *See all plannings*; *See schedule of people in my groups*.
- **Problems**: *See (author)* (dá acesso a abas Costs/Tasks, criar tarefa e resolver se técnico/grupo atribuído); *See All*.
- **Changes**: *See (author)* (idem); *See All*; Validation: *Create*, *Purge*, *Validate*.

## Relações
- Módulo funcional: [[Módulo de Assistência (Service Desk)]], [[Gestão de Incidentes e Requisições (processo)]].
- Objetos: [[Ticket]], [[Followups públicos e privados]], [[Validação e aprovação (regra)]].
- Ciclo de vida por perfil: [[Matriz de ciclo de vida (transições de status por perfil)]].
- Priorização: [[Priorização (urgência × impacto)]].
- Planning: [[Planejamento e Agenda (visões de planning)]].
- Conceito de perfil: [[Perfil de Usuário (conceito e composição)]].
