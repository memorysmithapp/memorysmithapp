---
title: Host Aggregate
aliases:
  - Agregado de Hosts
tags:
  - compute
  - scheduling
  - cloud
  - openstack
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Agrupamento lógico de nós de computação por perfil de hardware, definido por metadados e usado pelo scheduler para direcionar workloads.

## Conceito

Onde a [[Availability Zone]] agrupa por **onde o hardware está**, o host aggregate agrupa por **o que o hardware é**: tipo de hipervisor, classe de disco, família de CPU, presença de GPU, velocidade de rede — ou até dedicação a um único tenant.

É um rótulo, não uma topologia. Por isso um nó pode pertencer a vários aggregates simultaneamente, e um aggregate pode atravessar AZs e regiões.

## Características

- Criado **antecipadamente** pelo operador, anexando metadados aos nós escolhidos.
- O usuário seleciona o aggregate que atende ao requisito do seu workload.
- Boa prática: catalogar todas as capacidades de hardware assim que os nós entram, e agrupá-las por **workload esperado**, não por especificação isolada.

## Exemplo

Quatro aggregates sobre a mesma infraestrutura:

| Aggregate | Espalhamento | Metadado / workload |
|---|---|---|
| HA_1 | 1 região, 1 AZ | GPU + banda alta, baixa latência — HPC. Disponibilidade não é exigência |
| HA_2 | 1 região, 2 AZs | SSD + memória + banda — big data (Hadoop, Cassandra) |
| HA_3 | 2 regiões, 3 AZs | Capacidades padrão — aplicações web críticas |
| HA_4 | 1 região, 1 AZ | Hipervisor VMware — estende um vCenter existente |

## Veja também

- [[Availability Zone]]
- [[Placement]]
- [[Affinity e Anti-Affinity]]
- [[Nova]]
