---
title: Aba Sockets (tomadas físicas de cabeamento)
aliases: [Sockets tab, Aba Sockets, Tomadas físicas]
tags: [tab, sockets, cables, cabling, network]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-g3-023 · Aba Sockets (tomadas físicas de cabeamento)|EV-2-g3-023]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Aba Sockets (tomadas físicas de cabeamento)

A aba **Sockets** lista as **tomadas físicas** presentes no hardware (Ethernet, USB, HDMI, etc.). Diferentemente das portas de rede, **não** são retornadas pelo inventário automático — a adição é manual. Permitem ligar hardwares por **cabos** e relacionam-se ao objeto **cables**.

> [!warning] Distinção
> Não confundir com a [[Aba Tomadas (Plugs de PDU)]] (plugs de energia de um PDU): esta aba **Sockets** trata de tomadas físicas de **cabeamento de dados** (conectores).

> [!note] Adicionar (unitário e em massa)
> **Add a socket**: nome; **socket model** (criável via **+**); location; **wiring side** (rear/front); **Add**. Para vários: marcar *Add several sockets*, com prefixo/sufixo. **Advanced Setup** (após validar): posição, tipo de hardware, a máquina e o hardware onde o socket está (geralmente uma placa de rede). Para conectar a outro equipamento, usar **cables**.

## Ver também
- [[Rede (portas, IP, VLAN)]] · [[Ligação de dois dispositivos por cabo (endpoints)]] · [[Aba Portas de Rede (ativos)]]
