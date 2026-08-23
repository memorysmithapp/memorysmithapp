---
title: EV-1-032 · Tipos de regra especializados
aliases: [EV-1-032]
tags: [evidence, dominio/admin, regras]
type: evidence
status: confirmed
source: "SRC-001 · src/RuleRight.php L43 · src/RuleTicket.php L36 · src/RuleAsset.php L36 · src/RuleImportAsset.php L46 · src/RuleDictionarySoftware.php"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-032 · Tipos de regra especializados

> [!quote] subclasses de `Rule` (grep confirmado)
> ```php
> class RuleRight extends Rule { ... }               // atribui perfil/entidade no login (LDAP/SSO)
> class RuleTicket extends RuleCommonITILObject { ... } // regras de negócio em chamados
> class RuleAsset extends Rule { ... }                // regras de negócio em ativos (ONADD/ONUPDATE)
> class RuleImportAsset extends Rule { ... }           // casamento/importação do inventário
> class RuleDictionarySoftware extends Rule { ... }    // normalização de nomes (dicionários)
> // + RuleEntity, RuleLocation, RuleMailCollector, RuleAssetCollection, ...
> ```

O motor genérico ([[EV-1-031 · Motor de regras Rule RuleCollection Criteria Action|EV-1-031]]) é especializado em vários **tipos**, cada um atuando num ponto:
- **RuleRight** — no login, atribui **perfil/entidade/grupo** conforme atributos LDAP/SSO
  (habilita o login *denied_by_rule*).
- **RuleTicket** (business rules) — no add/update de chamado, ajusta categoria, prioridade,
  atribuição, SLA (invocada no ciclo de vida, cf. [[EV-1-001 · CommonDBTM é o active-record base com ciclo add-update-delete|EV-1-001]] `assetBusinessRules`).
- **RuleAsset** — regras de negócio em ativos (ex.: definir estado/entidade).
- **RuleImportAsset** — decide como o **inventário** casa/cria ativos ([[Inventário automático (processo)]]).
- **Dicionários** (`RuleDictionary*`) — normalizam software, fabricantes, modelos, SO.

## Sustenta
- [[Tipos de Regra]]
- [[Motor de Regras de Negócio (capacidade)]]
