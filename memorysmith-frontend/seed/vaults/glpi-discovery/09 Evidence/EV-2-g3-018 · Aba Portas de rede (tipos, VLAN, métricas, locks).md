---
title: EV-2-g3-018 · Aba Portas de rede (tipos, VLAN, métricas, locks)
aliases: [EV-2-g3-018]
tags: [evidence, tab, network-ports, vlan, ethernet, wifi, locks]
type: evidence
status: confirmed
source: "SRC-002 · source/tabs/network_ports.rst · Network ports"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-g3-018 · Aba Portas de rede (tipos, VLAN, métricas, locks)

> [!quote] source/tabs/network_ports.rst — "Network ports"
> A aba gerencia as portas de rede de um computador (do inventário automático ou manuais). Uma porta = saída de uma interface de rede, caracterizada por **número** e **nome**. Informações: Name, Port number, MTU, Speed, Internal status, Last change, Number of I/O bytes, Number of I/O errors, Duplex, VLAN, Connected to, Connection, Deleted.
> Tipos: **físico** (ethernet, WiFi), **virtual network port** (loop-back local, alias, agregados), **point to point** (rede comutada). Cabeçalho da tabela traz o total de portas e opções de exibição (IP, características por tipo, MAC, VLANs).

> [!quote] Gestão por tipo
> **Ethernet**: tipo (par trançado, fibra mono/multi-modo), taxa (10Mb/100Mb/1Gb/10Gb), MAC; associa placa de rede e network plug; conexão liga duas portas (exige porta livre em cada equipamento).
> **WiFi**: modo da placa (ad-hoc, ponto de acesso, repetidor), versão do protocolo (ab, g), MAC; rede WiFi com ESSID e tipo Infrastructure/Ad-hoc.
> **Loop-back local**: porta virtual (localhost/127.0.0.1), sem atributo específico.
> **Alias**: refina uma porta física; contém porta base + MAC (ex.: `eth2.50` = VLAN 50 taggeada em `eth2`); ao trocar a porta de origem, herda o MAC.
> **Agregado**: agrupa várias físicas (bridges no Linux); contém portas de origem + MAC.

> [!quote] Adicionar porta e configurações
> Tipos adicionáveis: Ethernet, Wifi, Aggregation, Alias, Dialup, Local loop, Fiber channel port. Após adicionar, ver/modificar campos.
> **Metrics**: consumo de rede da máquina. **Network Name**: associar/criar nome de rede (com 1 nome, editável no próprio formulário da porta; com vários, só via formulário do network name). **Associate a VLAN**: uma ou mais VLANs (nome, comentário opcional, número; tags disponíveis); criar VLAN pelo **+**.
> **Locks**: campo bloqueado = modificado manualmente; o inventário automático não o modifica mais até desbloquear (via Actions > Delete permanently > Post). **Historical**: todas as mudanças (manuais ou por inventário).

## Sustenta
- [[Aba Portas de Rede (ativos)]]
- [[Campos e tipos de Porta de Rede (ativo)]]
