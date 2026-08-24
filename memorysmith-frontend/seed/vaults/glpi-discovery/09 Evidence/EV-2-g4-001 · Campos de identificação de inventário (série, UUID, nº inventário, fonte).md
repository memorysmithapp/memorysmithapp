---
title: EV-2-g4-001 · Campos de identificação de inventário (série, UUID, nº inventário, fonte)
aliases: [EV-2-g4-001]
tags: [evidence, campos-comuns, inventario, identificacao]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · tabs/common_fields/serial_number.rst · Serial number; tabs/common_fields/uuid.rst · UUID; tabs/common_fields/inventory_number.rst · Inventory number; tabs/common_fields/update_source.rst · Update source"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-g4-001 · Campos de identificação de inventário

Quatro campos comuns que identificam/rastreiam um ativo, com origens distintas (automática vs. manual).

> [!quote] Serial number (`serial_number.rst`)
> "This information is automatically retrieved by the automatic inventory. You can add/modify this information manually." O número de série é recuperado automaticamente pelo inventário, editável à mão.

> [!quote] UUID (`uuid.rst`)
> "The UUID (Universally Unique IDentifier) is automatically update by the automatic inventory. This UUID is the unique identifier of the motherboard." Editável manualmente; ao adicionar/modificar, o campo fica **bloqueado (locked)** por padrão e o inventário automático não o sobrescreve — pode ser desbloqueado. Recuperável via `dmidecode` (Linux), `wmic path win32_computersystemproduct get uuid` (Windows) ou Apple Logo > About This Mac > System report > Hardware UUID (Mac).

> [!quote] Inventory number (`inventory_number.rst`)
> "Inventory number is information added manually. It is generally managed internally by the company." Número de inventário: sempre manual, gerido internamente pela empresa.

> [!quote] Update source (`update_source.rst`)
> "Update source is the way in which the machine has been incremented in the inventory. If it was done by the agent, GLPI Native Inventory will be indicated. For a manual entry, this field will remain empty." É um dropdown; podem-se criar fontes manuais (Nome + comentário via **+**).

## Sustenta
- [[Identificadores de um ativo (número de série e número de inventário)]]
- [[UUID (identificador da placa-mãe)]]
- [[Fonte de atualização (update source)]]
