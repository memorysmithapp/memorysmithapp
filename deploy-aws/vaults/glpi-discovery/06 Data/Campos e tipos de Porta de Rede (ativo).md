---
title: Campos e tipos de Porta de Rede (ativo)
aliases: [Network port types, Tipos de porta de rede, Campos de porta de rede]
tags: [data, assets, network, ports, vlan, mac, ethernet, wifi]
type: entity
maturity: evergreen
reviewed: false
source: "[[EV-2-c3-004 · Aba Portas de Rede de um Computador|EV-2-c3-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Uma porta de rede é caracterizada por **número** e **nome**, mais atributos que dependem do **tipo**. Gerida na [[Aba Portas de Rede (ativos)|aba Network ports]]; modelo em [[Rede (portas, IP, VLAN)]].

## Grandes tipos
- **Physical port** — ethernet, WiFi...
- **Virtual network port** — loop-back local, alias, agregados...
- **Point to point** — rede comutada...

## Atributos por tipo
| Tipo | Atributos principais |
|---|---|
| Ethernet | Tipo (par trançado, fibra mono/multi-modo...), taxa de transferência (10Mb/100Mb/1Gb/10Gb...), endereço MAC; opcional: placa de rede e network plug |
| WiFi | Modo da placa (ad-hoc, ponto de acesso, repetidor...), versão do protocolo (ab, g...), MAC; opcional: placa de rede; rede WiFi com ESSID e tipo Infrastructure/Ad-hoc |
| Loop-back local | Porta virtual (localhost/127.0.0.1); sem atributo específico |
| Alias | Porta base + MAC (ex.: `eth2.50` = VLAN 50 taggeada em `eth2`); ao trocar a porta de origem, herda o MAC dela |
| Agregado | Portas de origem + MAC (agrupa várias físicas; bridges no Linux) |

## VLAN
A cada porta associam-se uma ou mais **VLANs**, definidas por: **nome**, **comentário opcional** e **número de VLAN**.

> [!note] Conexão Ethernet
> Uma conexão Ethernet liga **duas portas** (exige porta livre em cada equipamento); tipicamente uma porta de computador/periférico/impressora a uma de equipamento de rede (hub, switch).
