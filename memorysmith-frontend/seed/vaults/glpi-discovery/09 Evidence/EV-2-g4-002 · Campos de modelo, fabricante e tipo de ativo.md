---
title: EV-2-g4-002 · Campos de modelo, fabricante e tipo de ativo
aliases: [EV-2-g4-002]
tags: [evidence, campos-comuns, modelo, fabricante, tipo]
type: evidence
status: confirmed
source: "SRC-002 · tabs/common_fields/model.rst · Model; tabs/common_fields/manufacturer.rst · Manufacturer; tabs/common_fields/asset_type.rst · Asset type"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-g4-002 · Modelo, fabricante e tipo de ativo

Três dropdowns de classificação de hardware, todos podendo ser preenchidos pelo inventário automático e/ou manualmente, e reutilizados por templates e regras.

> [!quote] Model (`model.rst`)
> "When the inventory is uploaded, the ... field is filled in automatically. You can also create/add ... manually. Models can also be used by templates and rules." Ao criar um modelo: **Nome**, **Product number** (opcional), **Weight**, **Depth**, **Required units** (para servidor em rack), **Power connections**, **Power consumption**, indicação de half rack e imagens (front/rear/other). Se uma máquina com fotos é inserida num rack, as fotos ficam visíveis no rack.

> [!quote] Manufacturer (`manufacturer.rst`)
> "Manufacturers are automatically retrieved by the automatic inventory and assigned to the computer. you can also create/add them manually." Ao criar: **Nome** e IDs registrados emitidos pelo PCI-SIG para USB e/ou PCI (múltiplos via **+**).

> [!quote] Asset type (`asset_type.rst`)
> "This field is used in the same way for many GLPI objects (printer, computer, peripheral, etc.)." Exemplo com computador: "The type of computer allows you to specify whether the machine is a laptop, a server, a workstation, etc. There is no predefined type; the different types must be created." Usável por templates e regras. Criação: **+** → Nome → comentário (opcional) → **+ Add**. Exclusão via ação massiva.

## Sustenta
- [[Modelo de ativo (model)]]
- [[Fabricante (manufacturer)]]
- [[Tipo de ativo (asset type)]]
