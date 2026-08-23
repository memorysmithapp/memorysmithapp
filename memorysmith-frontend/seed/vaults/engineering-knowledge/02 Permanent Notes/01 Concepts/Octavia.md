---
title: Octavia
aliases:
  - OpenStack Load Balancer as a Service
  - LBaaS v2
tags:
  - openstack
  - load-balancing
  - networking
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Serviço de balanceamento de carga gerenciado do OpenStack, que escala horizontalmente criando VMs balanceadoras chamadas amphorae.

## Conceito

Substituiu o plugin LBaaS v1 do [[Neutron]] a partir do release **Liberty**. A diferença de arquitetura é o que o torna de classe enterprise: em vez de um driver dentro do Neutron, o Octavia **provisiona instâncias dedicadas** — as *amphorae* — que rodam o balanceador.

Herda o vocabulário do HAProxy.

## Estrutura

| Termo | Definição |
|---|---|
| **VIP** | Objeto L4 associado a uma porta Neutron; expõe o serviço e distribui aos membros |
| **Pool** | Grupo de instâncias servindo o mesmo conteúdo |
| **Pool member** | Instância do pool: IP + porta de escuta |
| **Listener** | Porta associada ao VIP que escuta as requisições |

Componentes de controle:

| Componente | Papel |
|---|---|
| **Controller worker** | Configura as amphorae |
| **API controller** | Interage com o worker para deploy, deleção e monitoramento |
| **Health manager** | Vigia cada amphora e dispara failover |
| **Housekeeping manager** | Limpa registros obsoletos e gerencia o spare pool |

## Veja também

- [[Load Balancer]]
- [[Neutron]]
- [[High Availability]]
