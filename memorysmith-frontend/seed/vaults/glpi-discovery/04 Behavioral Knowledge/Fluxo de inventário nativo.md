---
title: Fluxo de inventário nativo
aliases: [Fluxo de inventário, Inventory flow]
tags: [flow, inventario, dominio/ativos]
type: flow
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-1-021 · Inventário nativo orquestra parsers InventoryAsset|EV-1-021]]"
author: CAD Discovery
created: 2026-07-10
---

# Fluxo de inventário nativo

Sequência do processamento de um inventário recebido de um agente (deriva de
[[Inventário automático (processo)]] e [[EV-1-021 · Inventário nativo orquestra parsers InventoryAsset|EV-1-021]]).

```mermaid
sequenceDiagram
    participant AG as GLPI Agent
    participant EP as Endpoint de inventário
    participant INV as Glpi\Inventory\Inventory
    participant MA as MainAsset (Computer/Phone/...)
    participant PA as Parsers InventoryAsset
    participant DB as MariaDB

    AG->>EP: POST inventário (JSON/XML)
    EP->>INV: doInventory(dados)
    INV->>MA: identifica e concilia ativo principal (serial/uuid)
    MA->>DB: cria/atualiza ativo (CommonDBTM)
    INV->>PA: despacha seções (cpu, memória, software, portas, SO...)
    loop cada seção
        PA->>DB: cria/atualiza itens-filhos (dedup + regras)
    end
    INV-->>AG: resposta (status/erros)
```

Cada escrita passa pelo [[Ciclo de vida de um item (add-update-delete)]] e respeita entidade,
histórico e regras de importação.
