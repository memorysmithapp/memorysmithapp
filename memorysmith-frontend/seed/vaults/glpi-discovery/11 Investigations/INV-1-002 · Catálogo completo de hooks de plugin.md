---
title: INV-1-002 · Catálogo completo de hooks de plugin
aliases: [INV-1-002]
tags: [investigation, consumidor/cad, plugins]
type: investigation
status: open
source: "[[EV-1-007 · Hooks de plugin no ciclo de vida dos itens|EV-1-007]]"
author: CAD Discovery
created: 2026-07-10
---

# INV-1-002 · Catálogo completo de hooks de plugin

> [!question] Pergunta aberta
> Qual o conjunto completo de hooks em `Glpi\Plugin\Hooks` e em que pontos do núcleo cada um
> é disparado? Quais permitem **alterar** dados vs apenas observar?

Só foram confirmados `PRE_ITEM_ADD` e `POST_PREPAREADD` até agora ([[EV-1-007 · Hooks de plugin no ciclo de vida dos itens|EV-1-007]]). Catalogar
a classe `Hooks` inteira no **Módulo 6**. Relevante porque parte do comportamento de
produção pode ser injetada por plugins — ver [[INV-1-003 · Comportamento de produção via plugins fora do repo]].
