---
title: Affinity e Anti-Affinity
aliases:
  - Affinity
  - Anti-Affinity
  - Afinidade e Antiafinidade
tags:
  - scheduling
  - high-availability
  - cloud
  - performance
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Regras de agendamento que forçam instâncias de um mesmo grupo a ficarem juntas no mesmo host (afinidade) ou obrigatoriamente separadas (antiafinidade).

## Conceito

São dois lados do mesmo trade-off:

| | Afinidade | Antiafinidade |
|---|---|---|
| Coloca | Todas no mesmo host | Cada uma num host diferente |
| Otimiza | Latência entre componentes | Sobrevivência à falha do host |
| Custo | Ponto único de falha | Salto de rede entre componentes |
| Caso típico | Cache junto da aplicação, HPC | Réplicas de banco, nós de cluster |

Escolher entre eles é escolher entre **performance e disponibilidade** — raramente há resposta neutra.

## Características

No OpenStack, materializam-se como filtros do scheduler do [[Nova]] — `ServerGroupAffinityFilter` e `ServerGroupAntiAffinityFilter` — aplicados a um *server group*:

```bash
openstack server group create --policy anti-affinity pp_webgroup
openstack server create --image "Ubuntu 22.04" \
  --hint group=<group-uuid> --flavor 5 instance01
openstack server create --image "Ubuntu 22.04" \
  --hint group=<group-uuid> --flavor 5 instance02
```

O mesmo conceito aparece em Kubernetes como `podAffinity` e `podAntiAffinity`, e em VMware como regras DRS.

> [!important] Anti-afinidade não substitui multi-AZ
> Espalhar entre hosts protege da falha de um servidor. Não protege da falha do rack, da energia ou do data center — para isso é preciso [[Availability Zone]].

## Veja também

- [[Availability Zone]]
- [[Host Aggregate]]
- [[High Availability]]
- [[Nova]]
