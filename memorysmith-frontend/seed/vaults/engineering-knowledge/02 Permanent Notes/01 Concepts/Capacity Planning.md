---
title: Capacity Planning
aliases:
  - Planejamento de Capacidade
tags:
  - capacity-planning
  - infrastructure
  - cloud
  - operations
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Prática de prever quanto recurso uma infraestrutura precisará para atender à demanda do negócio, e dimensioná-la em consequência.

## Conceito

Em nuvem, o planejamento parte do **caso de negócio**, não do hardware disponível. Definido o tipo de workload, o conjunto de recursos necessários se estreita — hospedagem web genérica e análise de dados pedem máquinas diferentes; [[Network Functions Virtualization (NFV)]] pede atenção especial porque devora performance.

O raciocínio produtivo é **reverso**: em vez de perguntar quantas instâncias cabem, pergunte quais [[Flavor|flavors]] o negócio precisa oferecer — e derive CPU, RAM, disco e rede a partir disso.

## Características

Três princípios que diferenciam capacidade em nuvem de capacidade tradicional:

| Princípio | O que significa |
|---|---|
| **Operar com elasticidade** | Puxar mais recurso por automação diante de falha ou aumento de carga |
| **Esperar falhar** | Recurso substituível imediatamente, sem tempo gasto em conserto e reconfiguração durante incidente |
| **Rastrear o crescimento** | Consumo on-demand não é linear. Medir regularmente e atualizar o roadmap |

## Exemplo

Dimensionamento de um nó de computação para 200 instâncias de flavor Small:

```
CPU     (200 × 2 GHz) ÷ 2,6 GHz = 154 vCPU
        +20% overhead de SO      = 185 vCPU
        ÷ 16 (overcommit)        = 12 cores físicos

RAM     200 × 1024 MB            = 200 GB
        +20% overhead            = 240 GB
        ÷ 1 (overcommit 1:1)     = 240 GB

Disco   200 × 40 GB              = 800 GB → 900 GB–1 TB com swap e cache

Rede    50 Mbit/s por interface virtual, 1 link de 10 GB para 200 VMs
```

## Veja também

- [[Flavor]]
- [[Overcommitment]]
- [[Capacity and Performance Management]]
- [[Benchmarking]]
- [[FinOps]]
