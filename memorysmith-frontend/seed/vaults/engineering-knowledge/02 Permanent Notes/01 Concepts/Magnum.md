---
title: Magnum
aliases:
  - OpenStack Container Infrastructure Management
  - Container as a Service (CaaS)
tags:
  - openstack
  - containers
  - kubernetes
  - orchestration
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Serviço do OpenStack que entrega clusters de orquestração de container (COE) como recurso de primeira classe — o equivalente privado de EKS, GKE ou AKS.

## Conceito

Integrado no release **Liberty**, expõe COEs — Kubernetes, Docker Swarm, Mesos — via API própria. Os containers rodam sobre os nós hipervisores gerenciados pelo [[Nova]].

O que o Magnum entrega **não é o container, é o cluster**. Essa é a linha que o separa do [[Zun]].

## Estrutura

| Termo | Definição |
|---|---|
| **Bay** | Conjunto de nós rodando um COE. Implantado pelo Heat, composto de instâncias Nova (VM ou bare metal) |
| **BayModel** | Template dos recursos que compõem um bay; reutilizável entre COEs |
| **Pod** | Grupo de containers no mesmo nó do COE |
| **Service** | Abstração de arranjo de bays e políticas de acesso |
| **Replication controller** | Monitora, replica e re-spawna containers; escala pods |
| **Magnum client** | Delega ao cliente nativo: `docker` para Swarm, `kubectl` para Kubernetes |

## Características

Integrações com o resto do ecossistema:

- **[[Keystone]]** — papéis Kubernetes derivados de identidade OpenStack.
- **[[Neutron]]** — Flannel como overlay padrão de Kubernetes e Swarm.
- **[[Glance]]** — imagem pré-construída dos nós do cluster.
- **[[Cinder]]** — storage efêmero e persistente; driver Rexray para Swarm.

> [!important] Isolamento é a garantia do serviço
> Cada bay é isolado dos demais e **não pode ser compartilhado entre tenants**. É o que torna o Magnum seguro por desenho num ambiente multi-tenant.

## Veja também

- [[Zun]]
- [[Kubernetes (K8s)]]
- [[Container Orchestration]]
- [[Nova]]
