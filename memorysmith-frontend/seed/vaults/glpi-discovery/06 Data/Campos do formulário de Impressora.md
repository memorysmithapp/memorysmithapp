---
title: Campos do formulário de Impressora
aliases: [Campos de Impressora, Printer fields]
tags: [assets, data, printer, snmp, form]
type: entity
maturity: evergreen
reviewed: false
source: "[[EV-2-c1-007 · Formulário e abas de Impressora|EV-2-c1-007]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos do formulário de Impressora

Impressoras chegam via **descoberta SNMP** ou manualmente; dados como nível de tinta e contador de páginas podem ser alimentados (depende do fabricante). Campos: Name, [[Campos comuns de um ativo (formulário)|Location, Technician/Group in charge, Alternate username(+number), User, Group, Comments, Status]], **Sysdescr**, Printer type, Manufacturer, Model, Serial number, Inventory number, **SNMP Credentials**, **Management type**, Network, UUID, Update source, **Memory**.

- Campos próprios: **Sysdescr**, **SNMP Credentials**, **Memory**.
- Abas próprias: **Cartridges** e **Page counters** — ver [[Contadores de página e cartuchos da impressora]].
- Suporta [[Templates de itens (modelos)|templates]].
</content>
