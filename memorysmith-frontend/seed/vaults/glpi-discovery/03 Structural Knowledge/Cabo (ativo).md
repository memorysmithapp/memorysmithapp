---
title: Cabo (ativo)
aliases: [Cable, Cabo, Cabos]
tags: [assets, cable, connectivity, dcim, structural, doc]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-c2-006 · Cabos (cables.rst)|EV-2-c2-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Cabo (ativo)

Tipo de ativo que gerencia qualquer tipo de cabo (Ethernet, USB, HDMI, etc.). Um cabo liga **2 dispositivos** e indica o local físico (socket) onde é conectado em cada dispositivo. A partir do cabo é possível criar tickets, problemas, etc. para gestão completa.

## Composição
- Formulário base ([[Campos do formulário de Cabo]]): Name, Status, Cable Type, Technician in charge, Inventory number, Comments, Cable strand, Color.
- **Cable Type**: tipo do cabo; a lista de tipos é gerenciada em **setup > dropdowns > cable management** (é um [[Dropdown (lista suspensa customizável)]]).
- **Endpoint A / Endpoint B**: ligação de dois materiais — ver [[Ligação de dois dispositivos por cabo (endpoints)]].
- Abas: Management (financeiro/administrativo), Tickets (somente leitura; vínculo feito em Assistance > Ticket).

## Relações
- Depende de **Sockets** declarados no hardware ([[Rede (portas, IP, VLAN)]]).

> [!note] Lacuna documental
> A subseção "Cable Strand" existe no doc mas está vazia — ver [[INV-2-c2-002 · Seção "Cable Strand" sem conteúdo]].
