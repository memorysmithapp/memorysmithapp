---
title: Masakari
aliases:
  - OpenStack Instances High Availability Service
tags:
  - openstack
  - high-availability
  - failover
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Serviço que traz alta disponibilidade para dentro da instância: detecta falhas de VM, de processo e de hipervisor, e recupera automaticamente.

## Conceito

Antes dele, cada usuário escrevia os próprios scripts de recuperação de VM — trabalho manual, duplicado e frequentemente esquecido. O Masakari transforma isso em serviço do provedor, integrado ao [[Nova]].

Apoia-se em **Corosync** (camada de mensagens do cluster e atribuição de VIP) e **Pacemaker** (gerenciador de recursos). Compõe-se de uma API REST e um engine que executa as requisições de recuperação contra o Nova.

## Estrutura

Três monitores, três tipos de falha:

| Monitor | Processo | Ação |
|---|---|---|
| **Instance restart** | `masakari-instancemonitor` | Reinicia a instância no mesmo host |
| **Instance evacuation** | `masakari-hostmonitor` | Evacua as instâncias para outro compute saudável quando o hipervisor cai |
| **Process monitor** | `masakari-processmonitor` | Vigia `libvirtd` e `nova-compute`; na falha de um processo, impede novo agendamento naquele nó |

**Failover segment** é o construto que sustenta a evacuação: um grupo de nós de computação que se cobrem mutuamente.

## Características

- Aplica-se a instâncias **KVM**.
- A instância opta pelo serviço via propriedade: `openstack server set --property HA_Enabled=True <vm>`.

## Veja também

- [[High Availability]]
- [[Failover]]
- [[Nova]]
- [[Affinity e Anti-Affinity]]
