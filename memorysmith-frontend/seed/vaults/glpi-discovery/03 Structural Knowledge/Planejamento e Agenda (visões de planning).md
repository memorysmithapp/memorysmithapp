---
title: Planejamento e Agenda (visões de planning)
aliases: [Planning, Agenda, Planejamento]
tags: [planning, agenda, ical, webcal, planejamento]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-b2-003 · Planejamento (agenda) — visões e autorizações|EV-2-b2-003]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Planejamento e Agenda (visões de planning)

A **Agenda** (*Planning*) exibe tarefas planejadas de [[Ticket|tickets]], [[Problem|problemas]]
e [[Change|mudanças]], além de notas planejadas e elementos de plugins. O menu só é visível
com a autorização de perfil *View planning*. Filtra-se por data, faixa de horário e objetos.

Quatro visões, cada uma sujeita a uma autorização:

- **Personal view** — só os elementos do usuário conectado.
- **Group view** — elementos do grupo (requer *See planning of group's persons*).
- **Users view** — agenda de um usuário específico (requer *See all plannings*).
- **Groups** — agenda de um grupo específico (requer *See all plannings*).

A agenda pode ser exportada em **Ical** (integrar a um calendário externo) e **Webcal**
(assinar o planning do GLPI num calendário externo); o feed é protegido por uma **chave de
segurança** na URL, regenerável em *Preferences* — ver [[Fluxos ICAL e WEBCAL do Planejamento (chave de acesso remoto)]].
Com a autorização *See my personal planning*, a agenda pessoal aparece na página inicial
(somente leitura; itens são planejados a partir das tarefas).

Depende de [[Perfis e Direitos (RBAC)]] para as autorizações.
