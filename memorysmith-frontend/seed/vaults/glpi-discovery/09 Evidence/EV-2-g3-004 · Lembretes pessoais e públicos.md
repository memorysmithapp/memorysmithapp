---
title: EV-2-g3-004 · Lembretes pessoais e públicos
aliases: [EV-2-g3-004]
tags: [evidence, tools, reminders, planning, targets]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · source/modules/tools/reminders.rst · Manage personal or public reminders"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-g3-004 · Lembretes pessoais e públicos

> [!quote] source/modules/tools/reminders.rst — "Manage personal or public reminders"
> "A reminder in GLPI is simple text with attached files; it allows to transmit information to other users of the platform."
> Caracterizado por: um **lifetime** (tempo de vida), um **status**, a possibilidade de **aparecer no planning** e seus **targets**.
> Os lembretes criados aparecem na **home page** do GLPI ou no **planning** dos usuários-alvo.
> "It is possible to add a start date and an end date." Sem data de início: visível imediatamente até a data fim. Sem data fim: visível permanentemente a partir da data de início.
> "Adding a reminder to the planning makes it visible for targeted users": o proprietário (lembrete pessoal) ou todos os plannings (lembrete público). Um lembrete planejado **não é apagado** após a data fim.

> [!quote] Abas
> Inclui aba **documents** (anexos).
> **Target**: lembrete é pessoal por padrão (só visível ao autor). Para tornar-se público, adicionam-se targets: **entity, profile, group ou users**. Um lembrete público é visível por usuários de um perfil se este tiver permissão de leitura para lembretes públicos.
> Também inclui historical e all.

## Sustenta
- [[Lembretes pessoais e públicos (Reminder)]]
- [[Campos de um Lembrete]]
