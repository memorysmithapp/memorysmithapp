---
title: EV-1-007 · Hooks de plugin no ciclo de vida dos itens
aliases: [EV-1-007]
tags: [evidence, dominio/foundation, plugins, extensibilidade]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-001 · codebase/in/glpi/src/CommonDBTM.php (L50, 1336, 1345) · Glpi\\Plugin\\Hooks"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-007 · Hooks de plugin no ciclo de vida dos itens

> [!quote] `src/CommonDBTM.php`
> ```php
> use Glpi\Plugin\Hooks;                                   // L50
> // dentro de add():
> Plugin::doHook(Hooks::PRE_ITEM_ADD, $this);              // L1336
> Plugin::doHook(Hooks::POST_PREPAREADD, $this);           // L1345
> // (equivalentes em update()/delete(): PRE_ITEM_UPDATE, ITEM_ADD, etc.)
> ```

O núcleo dispara **hooks** em pontos-chave do ciclo de vida (`PRE_ITEM_ADD`,
`POST_PREPAREADD`, `ITEM_ADD`, `PRE_ITEM_UPDATE`, `ITEM_DELETE`…). Plugins registram
callbacks nesses pontos e podem **alterar `$this->input`** antes da persistência. É o
mecanismo central de extensibilidade que sustenta o ecossistema de plugins do GLPI, sem que
o núcleo conheça os plugins.

## Sustenta
- [[Sistema de Plugins (Hooks)]]
- [[Ciclo de vida de um item (add-update-delete)]]
