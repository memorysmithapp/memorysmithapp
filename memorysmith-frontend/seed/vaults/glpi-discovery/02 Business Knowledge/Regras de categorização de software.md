---
title: Regras de categorização de software
aliases: [Rules for assigning a category to software]
tags: [regras, software, categoria, doc]
type: rule
status: confirmed
source: "[[EV-2-e2-008 · Tipos de regra na administração e mecanismos auxiliares|EV-2-e2-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Tipo de regra que **atribui automaticamente uma categoria a um software**, facilitando exibir e encontrar software.

- Pode ser aplicada a qualquer software novo ou **retroativamente**.
- **Critérios** disponíveis: publisher (fabricante), name e comment do software.
- **Única ação** possível: atribuir o software a uma categoria.
- Reexecução via ação massiva **Recalculate category** na lista de software.

> [!note] Ponte doc×código
> Relaciona-se com [[Software, Versões e Licenças]] e [[Gestão de Software e Licenças (processo)]]. Não confundir com o [[Dicionários de dados (administração)|dicionário de software]], que altera nome/versão/fabricante.
