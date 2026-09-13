---
title: Itens vinculáveis a um documento
aliases: [Document linkable items, Associated Items]
tags: [component, management, document, doc]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-d1-006 · Documentos — armazenamento, cabeçalhos e itens vinculáveis|EV-2-d1-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Itens vinculáveis a um documento

A aba **Associated Items** de um [[Documento na interface (Document) — visão do usuário|documento]] permite ligá-lo a praticamente qualquer objeto do GLPI. A documentação lista (~90 tipos), abrangendo:

- **Ativos e componentes**: Computer, Monitor, Printer, Phone, Camera, Network device, e componentes (Battery, Processor, Memory, Hard drive, Controller, Graphics/Sound/Network card, Power supply, System board, Firmware, Drive, Sensor, Sim card, PCI device, Generic device) — incluindo suas variantes "item".
- **Gestão**: Appliance, Budget, Certificate, Cluster, Contact, Contract, Database instance, License, Line, Supplier.
- **Assistência/ITIL**: Ticket, Ticket task, Change, Change task, Problem, Problem task, Followup, Solution, Project, Project task, Reminder.
- **Consumíveis/modelos**: Cartridge Model, Consumable model, Case/Case item, Camera item.
- **Outros**: Knowledge base, Software, Document (um documento anexado a outro), Entity, User, Device.

A própria existência da aba **Documents** dentro de um documento decorre desta capacidade: um documento pode ter outros documentos anexados.

> [!note] Ponte doc×código
> Reflete a natureza transversal de [[Documentos (Document)]], anexável a quase todo o modelo de [[CommonDBTM (Active Record)]].
