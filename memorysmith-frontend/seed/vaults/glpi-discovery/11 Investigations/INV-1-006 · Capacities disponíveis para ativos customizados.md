---
title: INV-1-006 · Capacities disponíveis para ativos customizados
aliases: [INV-1-006]
tags: [investigation, consumidor/cad, custom-assets]
type: investigation
status: open
maturity: seed
reviewed: false
source: "[[EV-1-022 · Ativos customizáveis AssetDefinition com capacities e custom fields|EV-1-022]]"
author: CAD Discovery
created: 2026-07-10
---

# INV-1-006 · Capacities disponíveis para ativos customizados

> [!question] Pergunta aberta
> Qual o catálogo completo de **capacities** (`Glpi\Asset\Capacity\*`) que uma AssetDefinition
> pode ativar, e o que cada uma injeta no ativo (tabelas, abas, direitos)?

Só `IsInventoriableCapacity` foi visto explicitamente ([[EV-1-021 · Inventário nativo orquestra parsers InventoryAsset|EV-1-021]]). Catalogar a pasta
`src/Glpi/Asset/Capacity/` (varredura pendente). Impacta o que se pode modelar sem plugin —
ver [[Ativos Customizáveis (AssetDefinition)]].
