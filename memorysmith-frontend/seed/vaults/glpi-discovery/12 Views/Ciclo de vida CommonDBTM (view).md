---
title: Ciclo de vida CommonDBTM (view)
aliases: [Ciclo de vida view, add flow diagram]
tags: [view, ciclo-de-vida, dominio/foundation]
type: view
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-001 · CommonDBTM é o active-record base com ciclo add-update-delete|EV-1-001]]"
  - "[[EV-1-007 · Hooks de plugin no ciclo de vida dos itens|EV-1-007]]"
author: CAD Discovery
created: 2026-07-10
---

# Ciclo de vida CommonDBTM (view)

Sequência detalhada do `add()`/`update()`/`delete()` — deriva de
[[Ciclo de vida de um item (add-update-delete)]].

```mermaid
sequenceDiagram
    participant C as front/ ou API
    participant O as Item (CommonDBTM)
    participant P as Plugins (Hooks)
    participant DB as MariaDB
    participant L as Log

    C->>O: add(input)
    O->>P: PRE_ITEM_ADD
    O->>O: prepareInputForAdd (regras)
    O->>P: POST_PREPAREADD
    O->>O: filterValues + RuleAsset ONADD
    O->>O: filtra campos reais + datas
    O->>O: checkUnicity
    O->>DB: addToDB (INSERT)
    O->>L: Log::history (CREATE)
    O->>O: post_addItem (efeitos colaterais)
    O-->>C: id do novo item
```
