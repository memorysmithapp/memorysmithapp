---
title: Objetos GLPI e dropdowns no tipo de pergunta Item
aliases: [Form Item question objects]
tags: [formularios, forms, item, objetos, dropdowns, dados, doc]
type: table
maturity: evergreen
reviewed: false
source: "[[EV-2-e2-015 · Formulários nativos - migração e tipos de pergunta|EV-2-e2-015]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

O tipo de pergunta **Item** permite selecionar objetos do GLPI. Opção *Users devices*: o usuário seleciona seus próprios ativos.

## Objetos GLPI disponíveis (por grupo)
- **Assets**: Computers, Monitors, Network devices, Peripherals, Phones, Printers, Licenses, Certificates, Unmanaged assets, Appliances, Software, Cartridge models, Consumable models, Lines, Passive devices, PDUs.
- **Assistance**: Tickets, Changes, Problems, Recurrent tickets.
- **Management**: Budgets, Suppliers, Contacts, Contracts, Documents, Projects, Certificates, Appliances, Databases.
- **Tools**: Reminders, RSS Feed.
- **Administration**: Users, Groups, Entities, Profiles.

## Dropdowns disponíveis (por grupo)
Cobrem categorias como **Common** (Locations, Statuses, Manufacturers, Blacklists…), **Assistance** (ITIL category, Task categories/templates, Solution types/templates, Approval templates/steps, Request sources, Followup templates, Project states/types/tasks, External events templates, Event categories, Pending reason, Service catalog categories), **Type** e **Models** (dezenas de tipos/modelos de equipamentos), **Virtual machines**, **Management**, **Tools**, **Calendars**, **Operating systems**, **Networking**, **Cable management**, **Internet**, **Software**, **User**, **Authorizations assignment rules** (LDAP criteria), **Fields unicity**, **External authentications**, **Power management**, **Appliance**, **Camera**, **Others** (USB/PCI vendors, Webhook categories).

> [!note]
> A lista completa (dezenas de tipos e modelos) está no `.rst` de origem via blocos `.. collapse::`. Relaciona-se com [[Dropdown (lista suspensa customizável)]].
