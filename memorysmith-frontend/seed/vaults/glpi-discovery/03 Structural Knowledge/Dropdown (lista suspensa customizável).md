---
title: Dropdown (lista suspensa customizável)
aliases: [Dropdown, Lista suspensa, Intitulé]
tags: [dropdown, configuration, glossary]
type: concept
status: confirmed
source:
  - "[[EV-2-a2-003 · Status como visão específica|EV-2-a2-003]]"
  - "[[EV-2-a2-005 · Glossário oficial do GLPI|EV-2-a2-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Dropdown (lista suspensa customizável)

**Dropdown** é uma lista suspensa customizável usada em todo o GLPI e em plugins. É o mecanismo de configuração por trás de muitos campos de referência (status, localizações, fabricantes, categorias, etc.), permitindo ao administrador definir e reutilizar valores padronizados.

Os valores de dropdown podem ser **recursivos** — visíveis de subentidades (ver [[Recursividade em entidades]]).

> [!note] Exemplo: status
> Os valores de [[Status de itens (visão específica)|status]] de ativos são definidos via configuração de dropdown, indicando também os tipos de objeto a que se aplicam.

Termo do [[Glossário oficial (doc)]]: *Dropdown* — "Customizable dropdown list used in GLPI and plugins".
