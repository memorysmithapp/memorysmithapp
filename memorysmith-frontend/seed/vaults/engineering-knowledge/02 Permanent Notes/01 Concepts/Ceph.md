---
title: Ceph
aliases:
  - Ceph Storage
  - RADOS
tags:
  - storage
  - software-defined-storage
  - distributed-systems
  - openstack
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Sistema de [[Software-Defined Storage (SDS)]] distribuído que escala a exabytes sobre hardware commodity e serve, pela mesma base, armazenamento de objeto, bloco e arquivo.

## Conceito

O que distingue o Ceph é a **unificação das três interfaces sobre um único substrato**. No núcleo está o **RADOS** (Reliable Autonomic Distributed Object Store), que cuida de distribuição, replicação e gestão dos objetos. Bloco (RBD), arquivo (CephFS) e objeto são fachadas sobre ele.

No OpenStack, é o backend de terceiros mais adotado: serve [[Cinder]] via RBD, [[Glance]] como store de imagem, [[Manila]] via CephFS e [[Gnocchi]] como storage de métrica.

## Estrutura

| Componente | O que é |
|---|---|
| **OSD** (Object Storage Device) | Corresponde ao disco físico com filesystem (XFS, Btrfs) |
| **MON** (Monitor daemon) | Vigia a consistência dos dados e as métricas de cada OSD |
| **Pool** | Mapeamento dos objetos armazenados em OSDs |
| **PG** (Placement group) | Mapa objeto ↔ OSDs; replica objetos entre múltiplos OSDs de um pool |

## Características

- Escala massiva sobre x86 commodity — sem appliance proprietário.
- Autenticação própria: **cephx**, com keyring por cliente.
- Integração com OpenStack via `ceph-common` e a biblioteca `python-rbd` nos nós.

## Veja também

- [[Software-Defined Storage (SDS)]]
- [[Cinder]]
- [[Swift]]
- [[Object Storage]]
- [[Distributed Systems]]
