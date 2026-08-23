---
title: EV-1-021 · Inventário nativo orquestra parsers InventoryAsset
aliases: [EV-1-021]
tags: [evidence, dominio/ativos, inventario]
type: evidence
status: confirmed
source: "SRC-001 · src/Glpi/Inventory/Inventory.php L36–70 · src/Glpi/Inventory/Asset/InventoryAsset.php · src/Glpi/Inventory/MainAsset/MainAsset.php"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-021 · Inventário nativo orquestra parsers InventoryAsset

> [!quote] `src/Glpi/Inventory/Inventory.php` (imports dos parsers, L45–70)
> ```php
> namespace Glpi\Inventory;
> use Glpi\Inventory\Asset\{Antivirus, Battery, Bios, Camera, Cartridge, Controller,
>   DatabaseInstance, Drive, Environment, Firmware, GraphicCard, Memory, Monitor,
>   NetworkCard, NetworkPort, OperatingSystem, Peripheral, PowerSupply, Printer,
>   Process, Processor, RemoteManagement, Sensor, Simcard, Software, ...};
> ```

O GLPI tem **inventário nativo** (desde a v10, ex-FusionInventory). Um agente envia um
documento de inventário (JSON/XML) que a classe `Inventory` **orquestra**: identifica o
`MainAsset` (Computer, Phone, NetworkEquipment, Printer) e despacha cada seção para um
**parser** `InventoryAsset` especializado (processador, memória, software, portas de rede,
SO…). Cada parser cria/atualiza os itens-filhos correspondentes ([[EV-1-016 · Composição do ativo via Item_Devices e itens filhos|EV-1-016]]), com
deduplicação e regras de importação.

## Sustenta
- [[Inventário automático (processo)]]
- [[Fluxo de inventário nativo]]
