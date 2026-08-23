---
title: Campos dos componentes por família
aliases: [Component fields per family, Campos de componentes]
tags: [data, components, hardware, fields]
type: entity
status: confirmed
source: "[[EV-2-g3-010 · Aba Componentes por família (campos)|EV-2-g3-010]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos dos componentes por família

Detalhamento dos campos exibidos na [[Aba Componentes de Hardware (ativos)|aba Components]] por família de componente (complementa a lista de [[Componentes de hardware de um ativo (lista)]]). Além dos campos abaixo, cada família traz **Location**, **informação financeira e administrativa** (se ativada em Setup > General > assets) e origem por **inventário automático**.

| Família | Campos específicos |
|---|---|
| Firmware | Firmware, Manufacturer, Type, Version, Release Date |
| Processor | Processor, Manufacturer, Frequency, Serial number, Number of cores, Number of threads |
| Memory | Memory, Manufacturer, Type, Frequency, size, Serial number, Position of the device on its bus |
| Hard Drive | Hardrive, Type, Interface, Capacity (MIO), Serial number |
| Network card | Network, Manufacturer, MAC Address |
| Battery | Battery, Manufacturer, Type, Voltage (MV), Capacity (MWH), Serial number |
| Graphics card | Graphical card, Chipset, Memory (MIO), Manufacturer date, Real capacity (MWH) |
| Soundcard | Soundcard, Manufacturer |
| Controller | Controller, Manufacturer, Interface |

> [!note] Catálogo
> Os componentes devem existir previamente; novos são criados em **Setup > Components**.

## Ver também
- [[Aba Componentes de Hardware (ativos)]] · [[Composição de um Ativo (componentes)]] · [[Componentes de Hardware Configuráveis]]
