---
title: Migração de Links Externos para templates Twig (GLPI 11)
aliases: [External links Twig migration]
tags: [links-externos, twig, decisao, glpi11, migracao]
type: decision
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-f1-003 · Links externos, tags e templates Twig|EV-2-f1-003]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] Decisão de produto (doc)
> "External links now use Twig templates. Existing links will be converted automatically during the upgrade to GLPI 11, but new links need to use Twig syntax. `[NAME] -> {{ NAME }}`."

**Decisão / mudança de produto**: no GLPI 11, os [[Links Externos (external links)]] passaram a usar **templates Twig**.

- Links existentes são **convertidos automaticamente** durante o upgrade para o GLPI 11.
- Novos links precisam usar a **sintaxe Twig**: a notação antiga `[NAME]` passa a `{{ NAME }}` — ver [[Tags de Substituição em Links Externos]].

> [!note]
> Consequência: procedimentos/documentação anteriores que ensinavam a sintaxe `[TAG]` ficam desatualizados para novos links.
