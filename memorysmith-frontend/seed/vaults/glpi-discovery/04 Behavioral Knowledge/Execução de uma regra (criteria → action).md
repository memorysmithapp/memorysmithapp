---
title: Execução de uma regra (criteria → action)
aliases: [Rule execution, matching de regra]
tags: [flow, motor-de-regras, dominio/admin]
type: flow
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-1-031 · Motor de regras Rule RuleCollection Criteria Action|EV-1-031]]"
author: CAD Discovery
created: 2026-07-10
---

# Execução de uma regra (criteria → action)

Como a `RuleCollection` processa as regras de um tipo (deriva de [[Motor de Regras (engine)]]).

```mermaid
flowchart TD
    A[Evento: add/update, login, inventário] --> B[RuleCollection do tipo]
    B --> C[itera regras por ordem de prioridade]
    C --> D{critérios casam?\nAND/OR + operadores}
    D -- não --> C
    D -- sim --> E[aplica RuleActions\nassign/regex/append]
    E --> F{política do tipo}
    F -- parar na 1ª --> G[fim]
    F -- acumular --> C
    G --> H[dados alterados no item/sessão]
```

Operadores de critério incluem igualdade, contém, começa/termina, regex (`FIND`), existência e
**sob/na árvore** (`UNDER`) para entidades e localizações ([[EV-1-031 · Motor de regras Rule RuleCollection Criteria Action|EV-1-031]]).
