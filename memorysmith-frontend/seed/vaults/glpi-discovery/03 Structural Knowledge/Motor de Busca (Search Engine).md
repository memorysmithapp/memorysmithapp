---
title: Motor de Busca (Search Engine)
aliases: [Search Engine, Motor de Busca, Search, SEARCH_OPTION]
tags: [component, busca, dominio/foundation]
type: component
status: confirmed
source: "[[EV-1-005 · Motor de busca SQL dirigido por SEARCH_OPTION|EV-1-005]]"
author: CAD Discovery
created: 2026-07-10
---

# Motor de Busca (Search Engine)

O GLPI tem um **motor de busca genérico** (`Search`) que serve todas as listagens, filtros
salvos e exportações — não há SQL escrito à mão em cada tela.

## Como funciona
1. Cada itemtype declara suas **search options** — um mapa `id → {table, field, name,
   datatype, joinparams…}` (via `rawSearchOptions()`).
2. `Search::manageParams()` normaliza os critérios vindos da UI/API.
3. `Search::getDatas()` compõe o **SQL** (SELECT/JOIN/WHERE/ORDER/LIMIT) a partir dos
   metadados e executa.
4. `Search::showList()` renderiza a tabela; a mesma pipeline exporta CSV/PDF.
- Provider moderno: `Glpi\Search\Provider\SQLProvider` (ver [[EV-1-005 · Motor de busca SQL dirigido por SEARCH_OPTION|EV-1-005]]).

## Por que importa
- Restrições de **entidade** e **direitos** são injetadas automaticamente na query.
- É a base dos **filtros salvos**, dashboards e da busca da API.
- Ligações entre itemtypes viram JOINs a partir dos `joinparams` das search options.

> [!note]
> As search options de cada domínio (quais campos são pesquisáveis em Ticket, Computer…)
> serão catalogadas nos módulos respectivos e ligadas a [[Search options (metadados de busca por itemtype)]].
