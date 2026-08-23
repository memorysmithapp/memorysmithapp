---
title: Placement
aliases:
  - OpenStack Placement Service
  - Placement API
tags:
  - openstack
  - scheduling
  - resource-management
type: concept
status: evergreen
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Serviço que mantém o inventário de recursos disponíveis na infraestrutura e pré-filtra os candidatos antes que o scheduler decida.

## Conceito

Introduzido no release **Newton** dentro do Nova e depois promovido a projeto próprio, o Placement resolveu um problema de escala: antes dele, o `nova-scheduler` varria **toda** a fazenda de computação a cada requisição, aplicando todos os filtros habilitados. Em deployments grandes, isso não fecha.

A inversão foi transformar agendamento em **contabilidade de inventário**: cada nó publica o que tem, o Placement indexa, e o scheduler consulta por API.

O segundo ganho foi de escopo. Antes, só CPU e RAM eram rastreados. Hoje rede e armazenamento também publicam inventários no mesmo modelo — o que permite agendar uma instância pela **largura de banda disponível**, não só pelo hardware do host.

## Estrutura

| Construto | O que é |
|---|---|
| **Resource provider** | O recurso subjacente abstraído: nó de computação, pool de storage, rede |
| **Resource class** | Tipo do recurso. Padrão: `VCPU`, `MEMORY_MB`, `DISK_GB`, `IPV4_ADDRESS`, `PCI_DEVICE`, `VGPU`, `NUMA_CORE`. Custom: prefixo `CUSTOM_` |
| **Inventory** | Conjunto de resource classes que um provider oferece |
| **Trait** | Característica qualitativa do provider (`HW_CPU_X86_SVM`, `is_SSD`) |
| **Allocation** | Registro de que um consumer ocupa recursos de um provider |
| **Allocation candidates** | Lista de providers viáveis, recalculada a cada requisição |

Consulta típica:

```
GET /placement/allocation_candidates
    ?resources=DISK_GB:500,MEMORY_MB:2048,VCPU:4
    &required=HW_CPU_X86_SVM
```

A resposta traz dois objetos: `allocation_requests` (quais providers atendem) e `provider_summaries` (capacidade, uso e traits de cada um).

## Características

- Um `resource_tracker` em cada nó de computação reporta inventário e disponibilidade periodicamente.
- **Traits** podem vir das características da imagem Glance ou do `extra_specs` do flavor.
- Operadores podem criar traits customizados pela API.

## Veja também

- [[Nova]]
- [[Flavor]]
- [[Host Aggregate]]
- [[Overcommitment]]
