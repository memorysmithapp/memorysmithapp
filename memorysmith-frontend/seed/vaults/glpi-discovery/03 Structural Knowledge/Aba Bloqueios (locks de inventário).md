---
title: Aba Bloqueios (locks de inventário)
aliases: [Locks tab, Aba Locks, Bloqueio de campos]
tags: [assets, tab, locks, inventory, fields]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-c3-010 · Abas Links Externos e Bloqueios (locks)|EV-2-c3-010]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Aba **Locks**, que gerencia os **bloqueios de campos** de um item. Um lock impede que determinada informação seja sobrescrita pelo retorno do [[Inventário automático (processo)]].

> [!note] Bloqueio implícito por edição manual
> Um lock é ativado automaticamente quando um campo é **modificado manualmente**: ao editar o dado, um **cadeado** aparece ao lado do título do campo. A partir daí o inventário automático não altera mais esse campo.

> [!note] Desbloqueio
> Para desbloquear: ir ao objeto GLPI onde está o lock, na aba de lock marcar a checkbox do item, **Actions > Delete permanently > Post**. O cadeado desaparece e o campo volta a ser atualizável pelo inventário. Todas as alterações ficam na aba **histórico**.

Este mecanismo é a contraparte, na interface, da reconciliação entre dados manuais e o [[Fluxo de inventário nativo]]: protege as edições humanas de serem apagadas por descobertas automáticas.
