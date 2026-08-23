---
title: Neutron
aliases:
  - OpenStack Networking Service
  - Networking Service
tags:
  - openstack
  - networking
  - sdn
type: concept
status: evergreen
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Serviço de rede do OpenStack: entrega rede como recurso de primeira classe, com redes virtuais, sub-redes, portas, roteadores, firewall, VPN e balanceamento em autosserviço.

## Conceito

Substituiu o antigo `nova-network`, que vivia dentro do [[Nova]] e oferecia só o básico. A separação foi o que permitiu ao tenant ter controle granular de rede — e ao operador integrar soluções de [[Software-Defined Networking (SDN)]] de terceiros.

É o serviço mais complexo do núcleo, e o que mais recebe commits a cada release.

## Estrutura

| Componente | Onde | Papel |
|---|---|---|
| **Neutron server** | Controller | Portal de API; encaminha aos agentes pela fila e atualiza o banco |
| **Agente L2** | Compute e network | Comutação virtual via mechanism driver do ML2 |
| **Agente L3** | Network (ou compute, em DVR) | Roteamento entre redes; NAT, firewall, VPN |
| **Agente DHCP** | Network | Serviço DHCP por rede tenant, via `dnsmasq` |
| **Agente de metadados** | Network/compute | Serve metadados às instâncias |

## Características

### Categorias de rede

| Categoria | Quem cria | Característica |
|---|---|---|
| **Provider network** | Operador | Define tipo e interface física do tráfego |
| **Self-service (tenant)** | Usuário | Autocontida e isolada; só pode usar os tipos que o operador liberou |
| **External provider** | Operador | Provider network com roteamento externo |

### Plugins

- **Core plugin** — conectividade L2 e orquestração de rede, sub-rede e porta. Hoje é o **ML2**.
- **Service plugin** — roteamento, VPN, firewall, load balancing.

O **ML2** acabou com a era do plugin monolítico (antes era Linux Bridge **ou** OVS, nunca ambos). Combina duas dimensões:

- **Type drivers** — *como* segmentar: VLAN, [[VXLAN]], GRE, GENEVE, flat, local.
- **Mechanism drivers** — *quem* implementa: [[Open vSwitch (OVS)]], [[Open Virtual Network (OVN)]], Linux Bridge, VMware NSX, Cisco, OpenDaylight, OpenContrail.

Trocar de tunelamento em produção é instalar o driver e reconfigurar a lista.

## Veja também

- [[Open vSwitch (OVS)]]
- [[Open Virtual Network (OVN)]]
- [[Software-Defined Networking (SDN)]]
- [[Floating IP]]
- [[Octavia]]
- [[Distributed Virtual Routing (DVR)]]
