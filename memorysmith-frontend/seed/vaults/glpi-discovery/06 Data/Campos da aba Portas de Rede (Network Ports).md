---
title: Campos da aba Portas de Rede (Network Ports)
aliases: [Network Ports fields, Portas de rede]
tags: [data, fields, network, port, vlan, doc]
type: table
status: confirmed
source:
  - "[[EV-2-c2-001 · Equipamentos de rede (network-equipments.rst)|EV-2-c2-001]]"
  - "[[EV-2-c2-003 · PDUs (pdus.rst)|EV-2-c2-003]]"
  - "[[EV-2-c2-004 · Enclosures (enclosures.rst)|EV-2-c2-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos da aba Portas de Rede (Network Ports)

Aba comum a [[Equipamento de Rede (ativo)]], [[PDU (Power Distribution Unit)]] e [[Enclosure (chassis modular)]] para gerenciar as portas de rede do equipamento. Corresponde ao modelo de código [[Rede (portas, IP, VLAN)]].

| Campo | Observação |
|---|---|
| Name | Nome da porta |
| Port number | Número da porta |
| MTU | Maximum Transmission Unit |
| Speed | Velocidade |
| Internal status | Status interno |
| Last change | Última alteração |
| Number of I/O bytes | Bytes de entrada/saída |
| Number of I/O errors | Erros de I/O |
| Duplex | Modo duplex |
| VLAN | VLAN associada |
| Connected to | Porta conectada |
| Connection | Conexão |
| Deleted | Excluída (Sim/Não) |

**Aba Network Name** (equipamentos de rede): Network name, IP addresses, IP networks.
**Sockets**: portas físicas (Ethernet, USB, HDMI) — não retornadas pelo inventário automático; ligam o hardware via [[Cabo (ativo)]].
