---
title: Flavor
aliases:
  - Instance Type
  - Tipo de Instância
tags:
  - compute
  - cloud
  - capacity-planning
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Template de especificações que define o tamanho de uma instância: vCPUs, memória, disco raiz e, opcionalmente, características de hardware exigidas.

## Conceito

O flavor é a **unidade de oferta** de uma nuvem [[Infrastructure as a Service (IaaS)]]. O usuário não pede "4 GB de RAM" — pede um flavor. Essa indireção é o que permite ao operador padronizar o catálogo, prever a densidade por host e evitar fragmentação de capacidade.

É também o ponto de partida do [[Capacity Planning]]: define-se primeiro **o que o negócio precisa oferecer**, e daí se deriva o hardware. O raciocínio inverso — comprar servidores e depois pensar em flavors — deixa capacidade encalhada.

## Características

Composição mínima: **vCPU, RAM (incluindo swap) e disco raiz** (incluindo tamanho efêmero).

Especificações avançadas (`extra_specs`) podem exigir arquitetura de CPU, GPU, SSD ou classes de IOPS — que o scheduler traduz em requisitos de trait no [[Placement]].

Catálogo típico, dobrando a cada degrau:

| Flavor | vCPU | RAM (MB) | Disco (GB) |
|---|---:|---:|---:|
| Tiny | 1 | 512 | 10 |
| Small | 1 | 1024 | 20 |
| Medium | 2 | 2048 | 40 |
| Large | 4 | 4096 | 80 |

> [!tip] Flavor de sobra fecha o buraco
> Se um nó comporta 40 médias e 10 pequenas e ainda sobra espaço, crie um flavor com exatamente a lacuna. O objetivo é não deixar recurso encalhado por incompatibilidade de tamanho.

## Veja também

- [[Capacity Planning]]
- [[Overcommitment]]
- [[Placement]]
- [[Nova]]
