---
title: Enclosure (chassis modular)
aliases: [Enclosure, Chassis, Blade enclosure]
tags: [assets, enclosure, dcim, structural, doc]
type: component
status: confirmed
source: "[[EV-2-c2-004 · Enclosures (enclosures.rst)|EV-2-c2-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Enclosure (chassis modular)

Tipo de ativo usado para gerenciar **infraestruturas modulares**, como servidores blade, bays de armazenamento ou certos equipamentos de rede. Permite agrupar vários elementos físicos na mesma caixa, mantendo o gerenciamento individual dos componentes. Faz parte do DCIM ([[DCIM (Datacenter → Rack)]]).

## Composição (abas)
- Formulário base ([[Campos do formulário de Enclosure]]), incluindo **Power Supplies** (nº de fontes).
- **Items**: elementos presentes no chassis (adição manual).
- **Components**: o enclosure tem componentes específicos (via *Setup > Components*), por ser equipamento passivo sem software/firmware — permite adicionar **Generic device**, **PCI device** e **Power supply** (ver [[Composição de um Ativo (componentes)]]).
- **Network Ports** ([[Campos da aba Portas de Rede (Network Ports)]]).
- **Impact Analysis** e abas comuns: Management, Contracts, Documents, Tickets, Problems, Changes, Historical.

## Relações
- Suporta [[Templates de itens (modelos)]].
