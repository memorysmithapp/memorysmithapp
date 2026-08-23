---
title: Zun
aliases:
  - OpenStack Container Service
tags:
  - openstack
  - containers
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Serviço que roda containers diretamente no OpenStack, como recurso de primeira classe, sem orquestrador intermediário.

## Conceito

Sucessor do antigo driver `nova-docker`, promovido a projeto próprio. Entre o [[Magnum]] e ele há uma diferença clara de nível de abstração:

| | Entrega | Camada |
|---|---|---|
| **Magnum** | Um cluster COE (Kubernetes, Swarm) | Orquestração |
| **Zun** | O container em si | Runtime |
| `nova-docker` (extinto) | Container tratado como se fosse VM | — |

Foi exatamente a modelagem do container como VM que condenou o `nova-docker`.

## Características

Duas dependências próprias, ambas pontes com outros serviços:

- **Kuryr** — integra com o [[Neutron]] via `libnetwork` para rede de container.
- **Fuxi** — usa a API Docker para volumes respaldados por [[Cinder]] e [[Manila]].

O ciclo de vida do container pode ser gerido pela API nativa do Docker **ou** pela API Zun:

```bash
openstack appcontainer create --name meu_container cirros
openstack appcontainer attach meu_container    # equivalente ao docker attach
```

## Veja também

- [[Magnum]]
- [[Container]]
- [[Nova]]
