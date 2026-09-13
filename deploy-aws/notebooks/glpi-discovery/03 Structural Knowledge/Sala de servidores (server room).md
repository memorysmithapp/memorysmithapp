---
title: Sala de servidores (server room)
aliases: [Server room, Sala de servidores, Servers room]
tags: [management, datacenter, dcim, server-room]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-d2-003 · Data centers, salas de servidores e racks (data-centers.rst)|EV-2-d2-003]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Sala de servidores (server room)

Uma **Sala de servidores** é representada no GLPI por um **mapa esquemático** que mostra o espaço disponível para posicionar racks. Pode ser vinculada a um [[Data center (agrupamento de salas de servidores)|data center]] e a uma localização.

> [!note] O mapa é uma grade
> O mapa é uma grade definida por um número de **linhas e colunas**; **um rack consome um quadrado**. Uma imagem de fundo (background) pode enriquecer a visualização da sala, especialmente se gerada por ferramenta dedicada.

## Abas
- **Racks**: exibe e modifica o mapa da sala, adicionando [[Rack (ativo DCIM)|racks]] diretamente sobre o mapa. Se a sala tiver muitos elementos, pode-se alternar entre **visão de grade** e **visão de lista**.
- **Impact analysis**: exibe e constrói o esquema de impacto ([[Aba Análise de Impacto (diagrama de dependências)]]).
- Abas comuns: Management, Contracts, Documents, External-links, Tickets, Problems, Changes, Historical.

Compõe a hierarquia DCIM [[DCIM (Datacenter → Rack)]].
