---
title: Aba Virtualização (ativos)
aliases: [Virtualization tab, Aba Virtualização, VM tab]
tags: [assets, tab, virtualization, vm, uuid, computer]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-c3-009 · Aba Virtualização de um host|EV-2-c3-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Aba **Virtualization** da ficha de um host, que exibe os sistemas de virtualização associados — máquinas virtuais, contêineres, jails. Vários sistemas são suportados (HyperV, VMWare, VirtualBox, WSL, etc.).

> [!note] Vínculo host↔VM por UUID
> O GLPI liga host e VM pelo **UUID** (identificador único). Quando o UUID difere entre a máquina física e a virtual, o vínculo automático é impossível; a única forma manual é atribuir o *mesmo* UUID à VM declarada no host e à VM dentro do GLPI. Uma VM adicionada manualmente fica com "automatic inventory: No" (não editável).

> [!note] Remontagem e importação
> Uma VM pode ser remontada na aba de ativos ou incluída na aba de virtualização do host (via **Administration > Inventory > Virtualization**). Os catálogos de "virtualization system/model" são geridos em **Setup > Dropdowns > Virtual Machines** (ver [[Dropdown (lista suspensa customizável)]]).

A exclusão passa por **Put in trashbin** (ver [[Lixeira e purga (trash bin)]]) e, se a VM era um computador nos ativos, por **Delete permanently** na lixeira. Se a VM ainda existe no host, será remontada no próximo inventário — é preciso removê-la também do host. Campos em [[Campos de uma Máquina Virtual (ativo)]].
