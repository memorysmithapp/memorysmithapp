---
title: INV-2-c2-001 · Documentação de Bancos de Dados incompleta (stub)
aliases: [INV-2-c2-001]
tags: [investigation, consumidor/cad, assets, database, gap, doc]
type: investigation
status: open
maturity: seed
reviewed: false
author: CAD Discovery (doc)
created: 2026-07-12
---

# INV-2-c2-001 · Documentação de Bancos de Dados incompleta (stub)

> [!question] Lacuna documental
> A página `modules/assets/databases.rst` do módulo Assets contém apenas o título "Databases" e a diretiva `.. note:: to do` — **está por documentar**.

## Contexto
O ativo "Databases" é referenciado em `network-equipments.rst` como aba que "lists databases discovered by automatic inventory and those entered manually", indicando que o objeto existe e é povoado pelo inventário automático. Porém não há descrição dos campos, abas ou procedimentos na página dedicada.

## O que investigar
- Quais campos compõem o formulário de Database/DatabaseInstance no GLPI?
- Como o inventário automático descobre bancos de dados (ver [[Inventário automático (processo)]])?
- Confirmar contra o código-fonte (SRC-001) se há classe/tabela correspondente.

Evidência: [[EV-2-c2-011 · Bancos de dados — stub (databases.rst)|EV-2-c2-011]].
