---
title: EV-2-b2-001 · Gestão de mudanças — formulário, abas e fluxo
aliases: [EV-2-b2-001]
tags: [evidence, changes, mudancas, itil, assistance]
type: evidence
status: confirmed
source: "SRC-002 · modules/assistance/changes.rst · Manage changes (documento inteiro)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-b2-001 · Gestão de mudanças — formulário, abas e fluxo

> [!quote] Definição e origem
> "A change is a modification of the information system's infrastructure. A change can be created either from a ticket form or a problem form, in tab **Changes**, or from menu **Assistance > Changes**." (changes.rst, abertura)

> [!quote] Formulário compartilha termos com o ticket
> "The form to create a change is similar to the ticket creation form and shares with it many terms: *requester*, *watcher*, *assigned to*, *status*, *urgency*, *impact*, *priority*, *category*. (...) The validation process is also the same as tickets in order to allow preliminary validation of the change (tab *Validations*)." (changes.rst)

> [!quote] Fases da mudança
> "Once the change is created, it is possible to attach tickets but also impacted items (tab *Items*). An analysis phase (tab *Analysis*) consists in describing impacts and controls list in order to implement this change through a deployment plan, a backup plan and a checklist (tab *Plans*)." (changes.rst)
>
> "Same as tickets, task, costs and solution allow to follow and solve the change. For complex changes management, a change can be linked with one or several projects allowing a more detailed management." (changes.rst)
>
> "Changes use their own notifications (see configuration of email follow-ups)." (changes.rst)

> [!quote] Status
> "Several statuses are available, including some for test phases, validation, qualification, etc." (changes.rst, seção *Status*; ilustrado por `images/changes-status-1.png` e `changes-status-2.png` — capturas de tela).

> [!quote] Adicionar / excluir / restaurar
> Adicionar: "click on **+ Add** at the top of the screen (...) Fill in the various tabs". Excluir: "click on the change concerned (...) Click on put in trashbin at the bottom". Restaurar/purgar: pela lixeira (topo direito) → **Actions** → **Restore** ou **Delete permanently** → **Post**. Aviso: "**Delete permanently** remove definitively the change, you won't be able to get it back." (changes.rst)

> [!quote] Abas da mudança
> - **Analysis**: Impacts + Control list (para implementar a mudança). Imagem `images/changes-analysis.png`.
> - **Plans**: Deployment plan + Backup plan + Checklist. Imagem `images/changes-plans.png`.
> - **Statistics**: "showing how long it takes to take over, close a change, etc. Statistics similar to tickets".
> - **Approvals**: "send requests to groups and/or users (or certain users within a group) in order to obtain their validation of the change".
> - Abas incluídas: **Costs** (`../../tabs/cost.rst`), **Projects** (`../../tabs/projects.rst`), **Items** (`../../tabs/item.rst`), **Knowledge Base**, **Notes**, **Historical**, **All**.
> - **Problems** e **Tickets**: vínculos com tipos *Linked To / Duplicates / Son of / Parent of* ("for information purposes only"). Não é possível criar um novo problema/ticket aqui, apenas vincular existente. Desvincular exige **massive actions → Unlink ITIL Object**.
> - **Impact Analysis**: "create diagrams of your infrastructure and see the impact of a change on it" (remete a `tabs/impact_analysis`). (changes.rst)

## Sustenta
- [[Gestão de Mudanças na interface (procedimento)]]
- [[Vínculos entre objetos ITIL (tipos de ligação)]]
- [[Aba de Análise (impactos, causas, sintomas, controles)]]
- [[Estatísticas do Service Desk (relatórios)]]
