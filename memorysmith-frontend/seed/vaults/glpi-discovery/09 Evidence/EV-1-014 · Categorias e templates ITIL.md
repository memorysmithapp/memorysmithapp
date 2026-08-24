---
title: EV-1-014 · Categorias e templates ITIL
aliases: [EV-1-014]
tags: [evidence, dominio/service-desk, template, categoria]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-001 · src/ITILCategory.php L41 · src/ITILTemplate.php L46 · src/TicketTemplate.php L43 · src/ChangeTemplate*Field.php"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-014 · Categorias e templates ITIL

> [!quote] classes (grep confirmado)
> ```php
> class ITILCategory extends CommonTreeDropdown { ... }   // categorias em árvore
> abstract class ITILTemplate extends CommonDropdown { ... }
> class TicketTemplate extends ITILTemplate { ... }
> // sub-tabelas de campos por template:
> //   *TemplateMandatoryField, *TemplateHiddenField,
> //   *TemplatePredefinedField, *TemplateReadonlyField
> ```

- **ITILCategory** — árvore de categorias de chamado (define grupo/técnico padrão,
  template associado, visibilidade por incidente/requisição/mudança/problema).
- **ITILTemplate** (→ TicketTemplate/ChangeTemplate/ProblemTemplate) — modela o **formulário**
  de abertura: campos **obrigatórios**, **ocultos**, **pré-definidos** e **somente leitura**,
  cada um numa sub-tabela dedicada (ex.: `ChangeTemplateMandatoryField`).

## Sustenta
- [[Categorias e templates ITIL]]
- [[Gestão de Incidentes e Requisições (processo)]]
