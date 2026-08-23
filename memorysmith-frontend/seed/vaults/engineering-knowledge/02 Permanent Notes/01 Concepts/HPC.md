---
title: HPC
aliases:
  - High-Performance Computing
  - Computação de Alto Desempenho
tags:
  - compute
  - performance
  - infrastructure
type: concept
status: seed
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Classe de workload que agrega poder computacional de muitos nós para resolver problemas que uma máquina isolada não resolve em tempo útil.

## Conceito

Simulação científica, modelagem climática, dinâmica de fluidos, treinamento de modelos grandes. O que une esses casos é a demanda simultânea por **CPU/GPU densa, memória alta e rede de baixíssima latência** entre os nós.

## Características

- A nuvem não "cria" performance de hardware — ela permite **crescer horizontalmente** quando a demanda de computação, storage e rede aumenta, e garante o isolamento multi-tenant no acesso.
- Exige planejamento de hardware específico: a escolha de layout físico e a seleção de componentes precedem qualquer ganho.
- Pode rodar sobre infraestrutura virtualizada, sobre bare metal ([[Ironic]]), ou ambos.
- Latência de rede costuma ser a restrição dominante — daí a preferência por [[Affinity e Anti-Affinity|afinidade]] e por [[Host Aggregate|aggregates]] com GPU e banda alta.

> [!info] Nota histórica
> Nos primeiros dias do OpenStack, quando só existiam Nova e Swift, NASA e Rackspace montaram o primeiro ambiente de produção justamente para HPC.

## Veja também

- [[Host Aggregate]]
- [[Ironic]]
- [[Capacity Planning]]
