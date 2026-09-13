---
title: EV-2-c3-010 · Abas Links Externos e Bloqueios (locks)
aliases: [EV-2-c3-010]
tags: [evidence, doc, assets, links, locks, inventory]
type: evidence
maturity: evergreen
reviewed: false
source:
  - "SRC-002 · modules/assets/tabs/links.rst · External links"
  - "SRC-002 · modules/assets/tabs/locks.rst · Locks"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] modules/assets/tabs/links.rst — "External links"
> A aba `External links` permite gerenciar links externos. Para alguns elementos, os links externos são geridos no menu **Setup > External links** (ver "Manage external links"). Captura de tela no doc: `links.png`.

> [!quote] modules/assets/tabs/locks.rst — "Locks"
> Os **locks** impedem que certas informações sejam modificadas durante o retorno do inventário automático. Esses bloqueios são ativados quando uma modificação manual foi feita.
>
> - **Bloquear um campo (Lock a field):** para bloquear um campo, modifica-se manualmente o dado desse campo. Quando um campo é modificado manualmente, um cadeado (padlock) aparece ao lado do título.
> - **Desbloquear um campo (Unlock a field):** ir ao objeto GLPI onde o bloqueio está; na aba de lock, marcar a checkbox do item a desbloquear; **Actions > Delete permanently > Post**. O cadeado desaparece e o campo volta a poder ser modificado pelo inventário automático.
> - Todas as alterações são armazenadas na aba **historical** (histórico).
>
> Capturas de tela no doc: `locks.png`, `locks-activated.png`.

## Sustenta
- [[Aba Links Externos (ativos)]]
- [[Aba Bloqueios (locks de inventário)]]
