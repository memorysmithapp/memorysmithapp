---
title: Galera Cluster
aliases:
  - Galera
  - MySQL Multi-Master Replication
  - Certification-Based Replication
tags:
  - database
  - high-availability
  - replication
  - consistency
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Solução de replicação síncrona multi-master para MySQL/MariaDB que usa replicação baseada em certificação (CBR) para resolver o conflito de escrita concorrente.

## Conceito

O Galera existe porque as topologias anteriores de HA de MySQL falhavam no mesmo ponto: **perda de transação no failover**.

O mecanismo do **CBR** assume duas propriedades do banco:

1. Ele é transacional e pode **reverter mudanças não commitadas**.
2. Os eventos replicados são aplicados **na mesma ordem** em todas as instâncias.

Com isso, a replicação é verdadeiramente paralela — cada evento carrega um ID de verificação, e o conflito é detectado por certificação em vez de ser evitado por serialização.

## Comparação

| Topologia | Mecanismo | Limitação |
|---|---|---|
| **Master/slave** | VIP migra ao slave na falha | Atraso no health check e na migração do VIP causa inconsistência |
| **MMM** | Dois masters, só um aceita escrita por vez | Pode perder transações na falha do master |
| **Shared storage** | Dois servidores, storage redundante compartilhado | Excelente uptime, hardware caro |
| **Block-level (DRBD)** | Replica o dispositivo de bloco | Barato, mas não escala para centenas de nós |
| **Galera** | Replicação síncrona multi-master com CBR | Exige mínimo de **três nós** |

## Características

- Mínimo de três nós para quórum.
- Adicionar um nó ao cluster pode ser automatizado — é o ganho operacional decisivo em ambientes que crescem.
- No OpenStack, o chaveamento entre instâncias depende do HAProxy, e o serviço `wsrep` roda nos três controllers.

> [!warning] Adicionar nó em cluster vivo tem armadilha
> A falha típica ao expandir um Galera em produção é o nó novo não conseguir ler os binary logs e atualizar o status de replicação.

## Veja também

- [[High Availability]]
- [[Quorum Queue]]
- [[Stateful vs Stateless]]
- [[Consensus]]
- [[Eventual Consistency]]
