---
title: Quorum Queue
aliases:
  - Fila de Quórum
  - RabbitMQ Quorum Queue
tags:
  - messaging
  - high-availability
  - consensus
  - distributed-systems
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Fila replicada que usa um algoritmo de consenso distribuído — variante do Raft — para manter um líder e múltiplos seguidores, garantindo ordem e durabilidade das mensagens sob falha.

## Conceito

É a resposta ao fracasso das **mirrored queues**, o padrão anterior de HA do RabbitMQ. O espelhamento replicava a fila em outros nós do cluster e comutava para um espelho na falha — mas sofria com falhas de sincronização e degradação de performance sob carga.

A fila de quórum troca espelhamento por **consenso**: um líder eleito, seguidores replicando um FIFO, e a maioria decidindo o que está comprometido. Ganha-se não só disponibilidade, mas **consistência** das mensagens.

## Comparação

| | Clustering | Mirrored queues | Quorum queues |
|---|---|---|---|
| O que replica | Estado do broker | A fila, para outros nós | A fila, via log replicado |
| Mecanismo | — | Espelho passivo | Consenso (Raft) |
| Problemas | — | Falha de sincronização, performance | — |
| Status | Ativo | **Depreciado** | **Padrão atual** |

## Características

- Cada fila tem um **líder** e múltiplos **seguidores**, hospedados em hosts distintos.
- Implementa **FIFO replicada** — a ordem é preservada entre réplicas.
- Migrar um ambiente em execução exige reiniciar os serviços e limpar os exchanges existentes; automatizar isso pelo pipeline é a recomendação.

## Veja também

- [[Message Queue]]
- [[Consensus]]
- [[High Availability]]
- [[Galera Cluster]]
