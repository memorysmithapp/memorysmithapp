---
title: Campos de uma Máquina Virtual (ativo)
aliases: [Virtual machine fields, Campos de VM]
tags: [data, assets, virtualization, vm, fields, uuid]
type: entity
maturity: evergreen
reviewed: false
source: "[[EV-2-c3-009 · Aba Virtualização de um host|EV-2-c3-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Informações de uma máquina virtual na [[Aba Virtualização (ativos)|aba Virtualization]] (variam conforme o sistema; exemplo para uma VM):

| Campo | Semântica |
|---|---|
| Name | Nome da VM |
| Automatic Inventory | Origem do registro (VM manual fica "No", não editável) |
| Virtualization system | Sistema de virtualização (HyperV, VMWare, VirtualBox, WSL...) |
| Virtualization model | Modelo de virtualização |
| State | Estado da VM |
| UUID | Identificador único usado para vincular host↔VM |
| Processors number | Nº de processadores |
| Allocated memory | Memória alocada |
| (host) | Nome da máquina física que hospeda a VM |

> [!note] UUID como chave de vínculo
> O vínculo host↔VM depende de um **UUID** idêntico dos dois lados. Se divergirem, o vínculo automático falha e só o ajuste manual do UUID resolve.

Catálogos de "system/model" em **Setup > Dropdowns > Virtual Machines** ([[Dropdown (lista suspensa customizável)]]).
