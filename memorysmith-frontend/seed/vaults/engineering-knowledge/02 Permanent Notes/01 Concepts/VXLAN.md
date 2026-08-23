---
title: VXLAN
aliases:
  - Virtual Extensible LAN
  - Overlay Network
tags:
  - networking
  - sdn
  - encapsulation
  - virtualization
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Protocolo de encapsulamento que cria redes L2 virtuais sobre uma rede L3 física, identificando cada rede por um VNI de 24 bits.

## Conceito

A VLAN, com seus 12 bits de tag 802.1Q, permite **4.096** redes. Num data center multi-tenant, isso acaba rápido.

O VXLAN resolve o teto encapsulando o frame L2 dentro de UDP e identificando a rede por um **VNI (Virtual Network Identifier)** de 24 bits — cerca de **16 milhões** de redes distintas.

O ganho colateral é maior que o principal: como o transporte é L3, a rede virtual **deixa de depender da topologia física**. Duas instâncias na mesma rede lógica podem estar em racks, salas ou data centers diferentes.

## Comparação

| | VLAN | VXLAN | GRE | GENEVE |
|---|---|---|---|---|
| Identificador | Tag 802.1Q (12 bits) | VNI (24 bits) | Chave de túnel | VNI + TLV |
| Redes possíveis | 4.096 | ~16 milhões | — | ~16 milhões |
| Transporte | L2 | UDP sobre L3 | IP | UDP sobre L3 |
| Cabeçalho | 4 bytes | 8 bytes | 4–16 bytes | **38 bytes** |
| Metadados extras | Não | Não | Não | **Sim (TLV extensível)** |

> [!important] GENEVE é o sucessor pragmático
> O VXLAN codifica **apenas o VNI**. O GENEVE usa TLV extensível e carrega informação adicional sobre o pacote — portas de ingresso e egresso, por exemplo. Isso habilita segurança de transporte, service chaining e telemetria in-band. É o tipo padrão do [[Open Virtual Network (OVN)]].

## Características

- Requer atenção ao **MTU**: o encapsulamento consome bytes do payload. Ignorar isso causa fragmentação e perda silenciosa de performance.
- No OpenStack, é o type driver padrão de rede tenant com [[Open vSwitch (OVS)]]; o VNI local é trocado pelo tunnel ID na `br-tun`.

## Veja também

- [[Software-Defined Networking (SDN)]]
- [[Open vSwitch (OVS)]]
- [[Open Virtual Network (OVN)]]
- [[Neutron]]
