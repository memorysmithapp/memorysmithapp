---
title: EV-1-022 · Ativos customizáveis (AssetDefinition) com capacities e custom fields
aliases: [EV-1-022]
tags: [evidence, dominio/ativos, custom-assets]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-001 · src/Glpi/Asset/AssetDefinition.php L63–78 · src/Glpi/Asset/AssetDefinitionManager.php · src/Glpi/Asset/Capacity/* · src/Glpi/Asset/CustomFieldType/*"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-022 · Ativos customizáveis (AssetDefinition) com capacities e custom fields

> [!quote] `src/Glpi/Asset/AssetDefinition.php`
> ```php
> final class AssetDefinition extends AbstractDefinition {   // extends CustomObject\AbstractDefinition
>     use AssetImage;
>     /** @var Capacity[] */ private ?array $decoded_capacities_cache = null;
>     public static function getCustomObjectBaseClass(): string { return Asset::class; }
> }
> // usa Capacity\CapacityInterface e CustomFieldType\{Dropdown,Raw,String,Text}Type
> ```

Novidade do GLPI 11: o usuário pode **definir novos tipos de ativo pela interface**
(`AssetDefinition`), sem programar. Cada definição gera uma classe de ativo (`Glpi\Asset\Asset`)
com:
- **Capacities** (`Capacity\*`) — recursos ativáveis (ser inventariável, ter portas de rede,
  Infocom, documentos, contratos, histórico…). É como o ativo "ganha" comportamentos do core.
- **Custom fields** (`CustomFieldType\*`) — campos personalizados (string, texto, dropdown, raw).

Isso torna o CMDB **extensível sem plugin**, mas move parte do modelo de dados para
**configuração** (tabelas de definição) em vez de código.

## Sustenta
- [[Ativos Customizáveis (AssetDefinition)]]
- [[INV-1-006 · Capacities disponíveis para ativos customizados]]
