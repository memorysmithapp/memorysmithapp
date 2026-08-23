---
title: Open vSwitch (OVS)
aliases:
  - OVS
  - Open vSwitch
tags:
  - networking
  - sdn
  - virtualization
  - openstack
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Switch virtual multicamada que roda no kernel do host e implementa comutação, tunelamento e regras OpenFlow entre máquinas virtuais e a rede física.

## Conceito

É o mechanism driver mais usado do ML2 do [[Neutron]], e a base sobre a qual o [[Open Virtual Network (OVN)]] foi construído. Suporta a maioria dos type drivers: VLAN, [[VXLAN]], GRE, flat e local.

Redes baseadas em túnel oferecem até **16 milhões de redes** distintas — a razão pela qual overlay é o padrão em ambientes grandes.

## Estrutura

| Processo | Papel |
|---|---|
| `openvswitch` | Módulo de kernel; data plane, processa os pacotes |
| `ovs-switchd` | Processo Linux que controla e gerencia os switches virtuais |
| `ovsdb-server` | Banco local dos switches virtuais |

### O caminho de um frame

```
instância → tapXXXX → qbrXXXX (Linux bridge) → br-int
   ├─ mesmo nó?  → br-int → porta de destino
   └─ outro nó?  → br-tun (encapsula) → br-ethX/br-ex → rede física
```

| Bridge | Papel |
|---|---|
| `br-int` | **Integration bridge** — consolida todos os dispositivos virtuais. Tráfego roteado por regras OpenFlow |
| `br-tun` | **Tunnel bridge** — encapsula e desencapsula; troca o VLAN ID local pelo tunnel ID |
| `br-ex` / `br-ethX` | **Provider bridge** — conectividade com a rede física e externa |

Integration e provider bridges se conectam por **patch cables**.

## Comparação

| | OVS | [[Open Virtual Network (OVN)]] |
|---|---|---|
| Controle e encaminhamento | Acoplados | Desacoplados |
| Programação de fluxo | Local, por host | Central, por banco lógico |
| Roteamento distribuído | Via configuração do Neutron | Nativo |
| Diagnóstico | `ovs-vsctl show`, `ovs-vsctl list-br` | Bancos NB e SB |

## Veja também

- [[Neutron]]
- [[Open Virtual Network (OVN)]]
- [[Software-Defined Networking (SDN)]]
- [[VXLAN]]
