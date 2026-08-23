---
title: EV-2-e1-006 · Aba Assistance do perfil (direitos de service desk, simplificada e padrão)
aliases: [EV-2-e1-006]
tags: [evidence, perfis, permissoes, assistance, tickets, followups, validacao]
type: evidence
status: confirmed
source: "SRC-002 · modules/administration/profiles/assistancetab.rst · Assistance permissions (Simplified / Standard interface)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-e1-006 · Aba Assistance do perfil (direitos de service desk, simplificada e padrão)

> [!quote] Interface simplificada (assistancetab.rst)
> **Tickets**: *See My Ticket* (tickets em que sou autor/requerente/observador + follow-ups públicos); *Create* (adiciona menu Create Ticket); *See Group Ticket* (tickets com um dos meus grupos como requerente/observador). **Followups**: *See Public Ones*; *Update followups (author)*; *Add followup (requester)* (também permite anexar documento); *Add followup (associated groups)*. **Tasks**: *See Public Ones* (também exibe a aba Tasks). **Validations**: *Validate an Incident*; *Validate a Request*; *Create for Request*; *Create for Incident* (a aba Validation aparece conforme os direitos e o tipo do ticket). **Associations**: *Link with items* (My Devices / All Items); *Associable items to a ticket* (tipos de ativo associáveis; All/None); *Default ITIL templates* (templates padrão de Ticket/Change/Problem do perfil — só templates recursivos da entidade raiz); *See hardware of my groups*.

> [!quote] Interface padrão
> Campos comuns à simplificada não são detalhados. **Tickets**: *Assigned Tickets* (pode ser atribuído); *Steal* (roubar o ticket — assume como técnico); *Change the Priority* (cancela cálculo automático); *See All Tickets*; *See Assigned*; *Assign* (adiciona técnico/grupo/fornecedor). **Followups**: *See Private Ones*; *Update All* (nota: técnico atribuído ou membro do grupo atribuído também modifica todos); *Add to all tickets*. **Tasks**: *See Private Ones*; *Update All*; *Add to all tickets*. **Planning**: *See personal planning*; *See all plannings*; *See schedule of people in my groups*. **Problems**: *See (author)* (também dá acesso às abas Costs/Tasks, criar tarefa e resolver se técnico/grupo atribuído); *See All*. **Changes**: *See (author)* (idem Problems); *See All*; e Validation: *Create*, *Purge*, *Validate*.

## Sustenta
- [[Aba Assistance de Perfil (direitos de service desk)]]
