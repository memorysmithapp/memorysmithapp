---
title: EV-2-b2-003 · Planejamento (agenda) — visões e autorizações
aliases: [EV-2-b2-003]
tags: [evidence, planning, agenda, planejamento, ical, webcal]
type: evidence
status: confirmed
source: "SRC-002 · modules/assistance/planning.rst · Managing plannings (documento inteiro)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-b2-003 · Planejamento (agenda) — visões e autorizações

> [!quote] O que a agenda exibe
> "Planning view allows to display planned tasks attached to a ticket, a problem or a change as well as planned notes or plugins' planned elements. This menu is only visible if profile includes `View planning` authorization. Date and time slot can be selected. A filtering on objects to include in planning is also available." (planning.rst)

> [!quote] Quatro visões (conforme autorizações)
> - **Personal view**: apenas os elementos do usuário conectado;
> - **Group view**: elementos do grupo do usuário conectado — requer *See planning of group's persons*;
> - **Users view**: agenda de um usuário específico — requer *See all plannings*;
> - **Groups**: agenda de um grupo específico — requer *See all plannings*. (planning.rst)

> [!quote] Exportação e chave de segurança
> "This information can be exported in two formats: Ical (integrar a calendário de ferramenta terceira) / Webcal (assinar um calendário terceiro ao planning do GLPI). Access to Ical and Webcal feed is protected by a security key integrated into the URL. It is possible to regenerate this key in menu `Preferences`." (planning.rst)

> [!quote] Agenda na página inicial
> "User's planning can be displayed on home page if profile has authorization *See my personal planning*. However, it is not possible to add an element to a planning from this interface; it is mandatory to plan a task or a note so that planning fills up." (planning.rst)

## Sustenta
- [[Planejamento e Agenda (visões de planning)]]
