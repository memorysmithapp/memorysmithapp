---
title: EV-1-031 · Motor de regras (Rule/RuleCollection/Criteria/Action)
aliases: [EV-1-031]
tags: [evidence, dominio/admin, regras, motor-de-regras]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-001 · src/Rule.php L50, 106–123 · src/RuleCollection.php L48 · src/RuleCriteria.php L46 · src/RuleAction.php L43"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-031 · Motor de regras (Rule/RuleCollection/Criteria/Action)

> [!quote] `src/Rule.php` — padrões de critério
> ```php
> class Rule extends CommonDBTM {
>     const PATTERN_IS=0;  const PATTERN_IS_NOT=1;  const PATTERN_CONTAIN=2;
>     const PATTERN_NOT_CONTAIN=3; const PATTERN_BEGIN=4; const PATTERN_END=5;
>     const PATTERN_EXISTS=8; const PATTERN_DOES_NOT_EXISTS=9;
>     const PATTERN_FIND=10; const PATTERN_UNDER=11; const PATTERN_NOT_UNDER=12; // árvores
>     const PATTERN_IS_EMPTY=30; const RULE_WILDCARD='*';
> }
> class RuleCollection extends CommonDBTM { ... }  // executa a lista ordenada de regras
> class RuleCriteria extends CommonDBChild { ... }  // condições (campo, operador, valor)
> class RuleAction extends CommonDBChild { ... }     // ações (assign, regex, append...)
> ```

O GLPI tem um **motor de regras genérico**: uma **Rule** é um par
**critérios (`RuleCriteria`) → ações (`RuleAction`)**, com matching AND/OR e operadores ricos
(igual, contém, começa/termina, existe, regex, **sob/na árvore** para entidades). A
**`RuleCollection`** executa as regras de um tipo em **ordem**, parando ou acumulando conforme
o tipo. É o mecanismo de automação transversal do produto.

## Sustenta
- [[Motor de Regras (engine)]]
- [[Execução de uma regra (criteria → action)]]
