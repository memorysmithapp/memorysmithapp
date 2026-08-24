---
title: EV-1-019 · DCIM — Datacenter, Rack, Item_Rack
aliases: [EV-1-019]
tags: [evidence, dominio/ativos, dcim]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-001 · src/Datacenter.php L41 · src/DCRoom.php L45 · src/Rack.php L46 · src/Item_Rack.php L40 · src/Enclosure.php L47 · src/PDU.php L46"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-019 · DCIM — Datacenter, Rack, Item_Rack

> [!quote] classes (grep confirmado)
> ```php
> class Datacenter extends CommonDBTM { ... }
> class DCRoom extends CommonDBTM implements DCBreadcrumbInterface { ... }  // sala
> class Rack extends CommonDBTM implements ... DCBreadcrumbInterface { ... }
> class Item_Rack extends CommonDBRelation { ... }   // posiciona um ativo numa posição U do rack
> class Enclosure extends CommonDBTM { ... }         // chassis/blade
> class PDU extends CommonDBTM { ... }               // régua de energia
> ```

O **DCIM** modela a localização física em datacenter numa hierarquia:
**Datacenter → DCRoom (sala) → Rack → Item_Rack (posição U de um ativo)**, com Enclosure
(chassis) e PDU (energia). O trait `DCBreadcrumb` ([[EV-1-015 · Ativos herdam CommonDBTM com traits Assignable-State-Inventoriable|EV-1-015]]) reconstrói a trilha de
localização de qualquer ativo montado. Suporta o desenho drag-and-drop de racks.

## Sustenta
- [[DCIM (Datacenter → Rack)]]
