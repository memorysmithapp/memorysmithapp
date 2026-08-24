---
title: Rack (ativo DCIM)
aliases: [Rack, Cabinet, Gabinete]
tags: [assets, rack, dcim, datacenter, structural, doc]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-c2-005 · Racks (racks.rst)|EV-2-c2-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Rack (ativo DCIM)

Ativo dedicado do GLPI que representa virtualmente a estrutura física de um rack/gabinete (patch bay, computer cabinet) usado para organizar, hospedar e conectar fisicamente equipamentos de rede e servidores em um datacenter ou sala técnica. É a peça central da visão de administrador do DCIM já modelado no código em [[DCIM (Datacenter → Rack)]].

## Objetivos (documentados)
- **Organizar equipamento**: visualizar/gerir servidores, switches, routers, UPS instalados.
- **Facilitar gestão física**: rastrear onde o equipamento está instalado em um espaço físico.
- **Otimizar espaço**: uso eficiente, deixando espaço para novos equipamentos.

## Composição (abas)
- Formulário base ([[Campos do formulário de Rack]]) com dimensões físicas, energia (Max./Measured power), peso, posição na sala, orientação da porta e **Server room**.
- **Items**: posição de cada elemento no rack — permite adicionar/mover/remover itens do parque.
- **Impact Analysis** e abas comuns: Contracts, Documents, Tickets, Problems, Changes, Reservations, Historical.

## Relações
- Contém [[Equipamento de Rede (ativo)]], [[PDU (Power Distribution Unit)]], [[Enclosure (chassis modular)]] e servidores.
- Suporta reservas (ver [[Reserva de Ativos e Documentos (processos)]]).
