---
title: Software-Defined Networking (SDN)
aliases:
  - SDN
  - Rede Definida por Software
tags:
  - networking
  - sdn
  - architecture
  - virtualization
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Abordagem de rede que separa a função de controle da função de encaminhamento, permitindo programar centralmente como os pacotes fluem.

## Conceito

Na rede tradicional, cada dispositivo decide **e** encaminha. Isso amarra a política de rede ao inventário de hardware: mudar o comportamento significa reconfigurar equipamento por equipamento.

O SDN quebra esse acoplamento. Uma camada de abstração num controlador define as regras de fluxo; os dispositivos apenas as executam. A rede vira **software configurável**, não hardware configurado.

É a mesma separação de [[Control Plane]], aplicada especificamente a rede.

## Características

- **Programabilidade** — regras de encaminhamento, roteamento e controle de acesso definidas por API.
- **Visão centralizada** — o controlador conhece a topologia inteira, o que permite decisões globalmente ótimas.
- **Overlay sobre underlay** — redes virtuais tuneladas ([[VXLAN]], GRE, GENEVE) sobre a infraestrutura física, o que descola a topologia lógica da física.
- **Independência de fornecedor** — a mesma política sobre hardware heterogêneo.

## Comparação

| | Rede tradicional | SDN |
|---|---|---|
| Controle | Distribuído nos dispositivos | Centralizado no controlador |
| Configuração | Por equipamento, manual | Por API, declarativa |
| Topologia lógica | Presa à física | Independente |
| Provisionamento de rede nova | Dias | Segundos |

## Exemplo

No OpenStack, o [[Neutron]] integra implementações SDN como mechanism drivers do ML2: [[Open Virtual Network (OVN)]], [[Open vSwitch (OVS)]], VMware NSX, OpenContrail, OpenDaylight, Cisco.

O OVN é o caso mais puro do conceito: desacopla explicitamente controle de encaminhamento por meio de bancos lógicos (northbound e southbound).

## Veja também

- [[Open Virtual Network (OVN)]]
- [[Open vSwitch (OVS)]]
- [[Control Plane]]
- [[Neutron]]
- [[VXLAN]]
