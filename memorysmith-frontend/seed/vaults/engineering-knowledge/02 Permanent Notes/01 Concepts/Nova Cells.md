---
title: Nova Cells
aliases:
  - Cells
  - CellV2
  - Nova CellV2
tags:
  - openstack
  - compute
  - scalability
  - sharding
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Mecanismo de sharding do [[Nova]] que particiona banco de dados e fila de mensagens entre grupos de nós de computação, permitindo escalar a computação sem saturar um único control plane.

## Conceito

As outras formas de segregação — [[Availability Zone]], [[Host Aggregate]], região — dividem a **topologia**. Cells dividem a **infraestrutura de suporte**: cada cell tem seu próprio banco e sua própria fila.

O problema que resolvem é de escala do control plane, não de tolerância a falha.

## Comparação

| | CellV1 (Juno) | CellV2 (oficial desde Ocata) |
|---|---|---|
| Estrutura | Árvore: root → child → grandchild | Plana, duas camadas, todas as cells iguais |
| Componente dedicado | `nova-cell` | Removido |
| Agendamento | Duas camadas: escolhe a cell, depois o host | Uma camada: o scheduler da API cell agenda uniformemente |
| Dados | Replicação pesada entre cells | Bancos separados, sem replicação |
| Expandir | Exige sincronização por cell | Só associar novos hosts |

A CellV1 falhou por dois motivos: o agendamento em duas camadas e o volume de dados replicados entre cells.

## Características da CellV2

A **API cell** roda `nova-api`, `nova-scheduler`, [[Placement]] e o **`nova-super-conductor`**, com o banco `nova_api` guardando metadados globais — flavors, quotas, keypairs.

A **Cell0** é especial: não roda serviço nenhum, apenas guarda o banco `nova_cell0` com as instâncias que **falharam ao agendar**.

Fluxo de criação de instância:

```
1. nova-api recebe e encaminha ao nova-scheduler
2. nova-scheduler consulta o Placement, filtra, escolhe o host
3. nova-api grava em nova_api.instance_mappings
4. nova-api grava no banco da cell alvo
5. nova-api → RPC → nova-super-conductor
6. nova-super-conductor → RPC → nova-conductor da cell → nova-compute
```

## Veja também

- [[Nova]]
- [[Database Sharding]]
- [[Availability Zone]]
- [[Placement]]
