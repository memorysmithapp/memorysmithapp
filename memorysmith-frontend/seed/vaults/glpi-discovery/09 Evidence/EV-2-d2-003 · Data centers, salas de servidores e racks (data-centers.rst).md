---
title: EV-2-d2-003 · Data centers, salas de servidores e racks (data-centers.rst)
aliases: [data-centers.rst, Data centers]
tags: [evidence, management, datacenter, dcim, doc]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/management/data-centers.rst · Data centers"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-d2-003 · Data centers, salas de servidores e racks (data-centers.rst)

Evidência da documentação sobre a gestão de **data centers** (salas de servidores e racks) no módulo Management.

> [!quote] data-centers.rst · introdução
> "Data centers management in GLPI, more precisely management of servers rooms and racks, allows to: Create an inventory of data centers, rooms and racks of the organization; Include data centers in GLPI financial management; Use other modules for data centers management, in particular `Assets` module which provides a detailed graphical representation of racks."

> [!quote] data-centers.rst · "Data center"
> "Data center in itself is a very simple object, with a name and a location, and allows only to group server rooms." Aba **Server rooms**: exibe as salas de servidores associadas ao data center e permite adicionar novas salas.

> [!quote] data-centers.rst · "Server room"
> "A server room is represented in GLPI by a schematic map. This map gives the space available in the room to place racks. A server room can be attached to a data center and to a location." Nota: "The map is a grid defined by a number of lines and columns. One rack consumes one square. The background image can enhance room visualization..."
> Abas da sala: **Racks** (exibe/modifica o mapa da sala adicionando racks diretamente no mapa; alterna entre visão de grade e visão de lista se houver muitos elementos); **Impact analysis** (constrói o esquema de impacto do data center); além de Management, Contracts, Documents, External-links, Tickets, Problems, Changes, Historical e "all".

Capturas no doc: `images/data-centers.png`, `images/serversrooms-data-centers.png`, `images/servers-room.png`, `images/plan-servers-room.png`, `images/impact-datacenters.png`.

## Sustenta
- [[Data center (agrupamento de salas de servidores)]]
- [[Sala de servidores (server room)]]
- [[Gestão de Data Centers e Salas de Servidores (capacidade)]]
- [[Aba Análise de Impacto (diagrama de dependências)]]
