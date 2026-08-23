---
title: Cinder
aliases:
  - OpenStack Block Storage Service
  - Block Storage Service
tags:
  - openstack
  - storage
  - block-storage
type: concept
status: evergreen
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Serviço de armazenamento em bloco do OpenStack: provê volumes persistentes que sobrevivem à terminação da instância à qual estão anexados.

## Conceito

A distinção que define o Cinder é **persistente × efêmero**. O disco efêmero morre com a instância; o volume Cinder não. Anexado, ele aparece na VM como um disco adicional, particionável e montável.

Nasceu dentro do [[Nova]] (release Bexar) e virou projeto próprio no Folsom.

## Estrutura

| Componente | Onde roda | Papel |
|---|---|---|
| `cinder-api` | Controller | REST de block storage |
| `cinder-scheduler` | Controller | Filtra e encaminha ao `cinder-volume` adequado |
| `cinder-volume` | Storage node | Gerente de volume; interface com o driver do backend |
| `cinder-backup` | — | Backup de volumes para outros sistemas |

Protocolos de acesso ao volume: **iSCSI, NFS, Fibre Channel**.

## Características

**Funções obrigatórias de qualquer driver:** attach, detach, create, delete, extend, migrate, criar imagem a partir de volume; e gestão de snapshot (criar, apagar, criar volume a partir de snapshot ou clone).

**Funções opcionais:** thin provisioning, live migration, multi-attach, QoS. Nem todo backend suporta todas — consultar a *support matrix* é passo de projeto, não detalhe.

**Agendamento multi-backend:** filtro `CapacityFilter` e pesagem `CapacityWeigher` por padrão. `VolumeNumberWeigher` espalha entre backends de mesmo nome; `GoodnessWeigher` avalia uma função de rating de 0 a 100:

```ini
[rbd]
goodness_function = "(capabilities.utilization < 50.0)?80:20"
```

**Volume types** são como o usuário escolhe o backend sem saber dele: cria-se um tipo com a propriedade `volume_backend_name` e o usuário pede o tipo.

## Veja também

- [[Block Storage]]
- [[Swift]]
- [[Manila]]
- [[Ceph]]
- [[Snapshot]]
