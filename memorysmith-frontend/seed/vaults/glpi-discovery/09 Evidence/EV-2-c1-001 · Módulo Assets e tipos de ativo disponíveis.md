---
title: EV-2-c1-001 · Módulo Assets e tipos de ativo disponíveis
aliases: [EV-2-c1-001]
tags: [evidence, assets, inventory, doc]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/assets/index.rst · Assets / Asset management in GLPI / Available types"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-c1-001 · Módulo Assets e tipos de ativo disponíveis

> [!quote] modules/assets/index.rst
> "The GLPI Asset module is used to manage all the assets that are part of your IT infrastructure, whether they have been added manually or brought up by automatic inventory."
> "In order to manage hardwares and software of an IT infrastructure, GLPI allows natively to list all the assets that are used inside the managed organization. However, it is possible to automate information pushing from the assets thanks to the native inventory and GLPI Agent."

Tipos de ativo disponíveis no módulo (toctree, `maxdepth: 3`): **computers, monitors, softwares, network-equipments, peripherals, printers, cartridges, consumables, phones, racks, enclosures, pdus, passives_devices, unmanaged_assets, cables, sim, global**.

> [!note] Notas do doc
> - Fusion Inventory não é mais suportado; recomenda-se o plugin **GLPI Inventory** (deploy de pacotes, inventário SNMP, coleta) ou o inventário nativo do GLPI para relatórios simples.
> - Documentação dedicada do GLPI Agent: `https://glpi-agent.readthedocs.io/`.
> - `.. todo::` no doc referencia uma seção ausente sobre gestão do protocolo IP (endereços IP, redes IP, FQDN).

## Sustenta
- [[Módulo de Ativos (Assets)]]
</content>
</invoke>
