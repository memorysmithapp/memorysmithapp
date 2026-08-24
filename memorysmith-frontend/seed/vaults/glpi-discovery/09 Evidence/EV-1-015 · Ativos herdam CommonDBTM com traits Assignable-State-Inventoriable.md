---
title: EV-1-015 · Ativos herdam CommonDBTM com traits Assignable/State/Inventoriable
aliases: [EV-1-015]
tags: [evidence, dominio/ativos, cmdb]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-001 · src/Computer.php L49–108 · src/Monitor.php L49 · src/NetworkEquipment.php L50 · src/Printer.php L50 · src/Phone.php L48"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-015 · Ativos herdam CommonDBTM com traits Assignable/State/Inventoriable

> [!quote] `src/Computer.php` (L49–68)
> ```php
> class Computer extends CommonDBTM
>     implements AssignableItemInterface, DCBreadcrumbInterface, StateInterface {
>     use DCBreadcrumb;
>     use Clonable;
>     use Inventoriable;
>     use Glpi\Features\State;
>     use AssignableItem;
>     public $dohistory = true;
>     protected static $forward_entity_to = ['Item_Disk','ItemVirtualMachine',
>         'Item_SoftwareVersion','Infocom','NetworkPort','ReservationItem','Item_OperatingSystem'];
>     public static $rightname = 'computer';
> }
> ```

Todos os ativos "principais" (Computer, Monitor, NetworkEquipment, Peripheral, Phone,
Printer, Rack, Enclosure, PDU) seguem o **mesmo padrão**: estendem [[CommonDBTM (Active Record)]]
e combinam traits/interfaces comuns:
- **AssignableItem** — atribuível a usuário/grupo (dono técnico).
- **State** — ciclo de status do ativo (em estoque, em uso, em manutenção, descartado…).
- **Inventoriable** — pode ser alimentado pelo inventário automático.
- **DCBreadcrumb** — trilha de localização em datacenter (Rack → Room → Datacenter).
- **Clonable** — clonagem com relações.

## Sustenta
- [[Modelo de Ativos (padrão comum)]]
- [[Gestão de Ativos e Configuração (SACM)]]
