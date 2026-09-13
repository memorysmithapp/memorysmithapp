---
title: EV-2-c1-009 · Ativos não gerenciados e conversão de tipo
aliases: [EV-2-c1-009]
tags: [evidence, assets, unmanaged, network-discovery, doc]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/assets/unmanaged_assets.rst · Unmanaged assets (todas as seções + Particularity)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-c1-009 · Ativos não gerenciados e conversão de tipo

> [!quote] modules/assets/unmanaged_assets.rst
> "Unmanaged equipment is equipment that is not directly administered by a GLPI agent or a protocol such as SNMP, WMI, etc. Unlike managed equipment, it does not automatically report information and must be manually updated in the inventory. These devices have been detected during a network discovery and can be converted into another type of object, either manually or via SNMP feedback."

**Campos do formulário de Ativo não gerenciado:** Name; Location; Manufacturer; Serial number; Inventory number; SNMP Credentials; Network; Update source; **Approved device: Yes/No**; Status; Technician in charge; Alternate username number; Alternate username; Sysdescr; User; Comments; **IP**; **Network hub: Yes/No**.

**Abas:** Network Ports; Domains; Locks; Import information; Historical; All.

> [!quote] Particularity — Massive actions
> "This item has a specific massive action which allows it to be converted into another type of object (computer, printer, etc.). You can convert it manually via this massive action, or report it via SNMP, WMI, etc."

## Sustenta
- [[Campos do formulário de Ativo não gerenciado]]
- [[Ativos não gerenciados (unmanaged assets)]]
- [[Conversão de ativo não gerenciado em outro tipo (fluxo)]]
</content>
