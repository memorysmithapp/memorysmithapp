---
title: EV-1-005 · Motor de busca SQL dirigido por SEARCH_OPTION
aliases: [EV-1-005]
tags: [evidence, dominio/foundation, busca, search-engine]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-001 · codebase/in/glpi/src/Search.php (L184, 221, 830) · src/Glpi/Search/Provider/SQLProvider.php"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-005 · Motor de busca SQL dirigido por SEARCH_OPTION

> [!quote] `src/Search.php` (assinaturas confirmadas por grep)
> ```php
> public static function showList(...)                       // L184  — renderiza a lista
> public static function getDatas($itemtype, $params, $forcedisplay = []) // L221 — executa a busca
> public static function manageParams(...)                   // L830  — normaliza filtros/criteria
> // ... funções que operam sobre o array $SEARCH_OPTION do itemtype
> ```
> Provider moderno: `src/Glpi/Search/Provider/SQLProvider.php`.

Cada itemtype (classe `CommonDBTM`) declara suas **search options** (via
`rawSearchOptions()`): um mapa numérico `id → {table, field, name, datatype, ...}`. O motor
de busca genérico (`Search`) transforma os critérios da UI/API nesse metadado em **SQL**
(SELECT/JOIN/WHERE/ORDER), aplicando automaticamente restrição por entidade e por direitos.
É o mesmo motor que alimenta as listas, os filtros salvos e a exportação (CSV/PDF).

## Sustenta
- [[Motor de Busca (Search Engine)]]
- [[Search options (metadados de busca por itemtype)]]
