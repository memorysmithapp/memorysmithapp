---
title: Gnocchi
aliases:
  - Gnocchi Time Series Database
tags:
  - openstack
  - telemetry
  - time-series
  - storage
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Banco de série temporal que serve de armazenamento oficial das métricas do [[Ceilometer]] desde o release Train.

## Conceito

Resolveu um gargalo concreto: o MongoDB, data store original da telemetria, não escalava para o volume de métricas de ambientes grandes.

A inversão de desenho: amostras **não vão direto ao banco**. Elas são convertidas em elementos Gnocchi, postadas na API nativa e gravadas já **agregadas** como série temporal — cada ponto com timestamp e medição.

O segundo ganho é a **indexação de recursos e seus atributos**, que torna a busca rápida.

## Características

- Delega o armazenamento a sistemas escaláveis: [[Swift]] ou [[Ceph]], via drivers próprios.
- O daemon **`metricd`** cuida da agregação, da gravação e da limpeza de métricas marcadas para deleção.
- **`gnocchi-statsd`** implementa o protocolo statsd para métricas de entrada.
- É o backend padrão de consulta do [[Aodh]].

## Veja também

- [[Ceilometer]]
- [[Aodh]]
- [[Time Series Database]]
