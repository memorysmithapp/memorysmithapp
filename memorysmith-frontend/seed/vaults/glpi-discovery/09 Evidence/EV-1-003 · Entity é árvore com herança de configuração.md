---
title: EV-1-003 · Entity é árvore com herança de configuração
aliases: [EV-1-003]
tags: [evidence, dominio/foundation, multi-tenancy, entidades]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-001 · codebase/in/glpi/src/Entity.php · linhas 57, 78–80, 786, 2210"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-003 · Entity é árvore com herança de configuração

> [!quote] `src/Entity.php` (trechos)
> ```php
> class Entity extends CommonTreeDropdown implements ...   // L57 — árvore hierárquica
>
> public const CONFIG_PARENT = -2;   // L78 — herdar valor da entidade-pai
> public const CONFIG_NEVER  = -10;  // L80
>
> public function maybeRecursive()   // L786 — item pode ser visível às sub-entidades
>
> // L2210 — resolve um parâmetro subindo a árvore de entidades até achar valor concreto
> public static function getUsedConfig($fieldref, $entities_id, $fieldval = '', $default_value = -2)
> ```

`Entity` estende `CommonTreeDropdown` → é um **dropdown em árvore** (tem pai, filhos,
`completename`). A separação de entidades é o mecanismo de **multi-tenancy** do GLPI: cada
item pertence a uma `entities_id` e pode ser `is_recursive` (visível às sub-entidades).
`getUsedConfig()` implementa **herança de configuração**: quando o valor de uma entidade é
`CONFIG_PARENT (-2)`, o sistema sobe a árvore até encontrar um valor concreto.

## Sustenta
- [[Modelo de Entidades (multi-tenancy)]]
- [[CommonTreeDropdown (dropdowns em árvore)]]
- [[Herança de configuração por entidade]]
