---
title: Sistema de Plugins (Hooks)
aliases: [Plugins, Hooks, Extensibilidade]
tags: [component, plugins, extensibilidade, dominio/foundation]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-1-007 · Hooks de plugin no ciclo de vida dos itens|EV-1-007]]"
author: CAD Discovery
created: 2026-07-10
---

# Sistema de Plugins (Hooks)

A extensibilidade do GLPI é feita por **hooks**: o núcleo dispara eventos nomeados
(`Glpi\Plugin\Hooks`) em pontos determinísticos, e plugins registrados executam callbacks —
o núcleo nunca conhece o plugin diretamente.

## Pontos de extensão observados
No ciclo de vida de itens ([[Ciclo de vida de um item (add-update-delete)]]):
`Hooks::PRE_ITEM_ADD` e `Hooks::POST_PREPAREADD` (ver [[EV-1-007 · Hooks de plugin no ciclo de vida dos itens|EV-1-007]]), com equivalentes em
update/delete (`PRE_ITEM_UPDATE`, `ITEM_ADD`, `ITEM_DELETE`…). Como o `$this` é passado, o
plugin pode **alterar `$this->input`** antes da persistência.

## Implicações
- Plugins vivem no namespace `GlpiPlugin\` (`NS_PLUG`).
- Comportamentos de negócio podem ser injetados sem tocar no núcleo — importante ao extrair
  requisitos: parte do comportamento de produção pode vir de plugins **fora** deste repo.

> [!question] A aprofundar (Módulo 6)
> Catálogo completo de hooks, ciclo de instalação/ativação de plugin e integração com o
> marketplace.
