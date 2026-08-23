---
title: Kubernetes Federation
aliases:
  - KubeFed
  - Federação Kubernetes
tags:
  - kubernetes
  - hybrid-cloud
  - multi-cloud
  - orchestration
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Modelo em que múltiplos clusters Kubernetes, possivelmente em nuvens diferentes, são controlados por um control plane comum que propaga configuração e workloads a todos.

## Conceito

Sem federação, operar N clusters significa manter o estado de cada aplicação em N lugares — e garantir manualmente que não divirjam. Federação inverte isso: **uma origem única de deployment** aplicada a um *host cluster* alcança todos os clusters conectados, com a visão de um único alvo.

Do ponto de vista do host, os demais são **member clusters**. Cada aplicação implantada ganha réplicas em todos os worker nodes visíveis.

## Comparação

| | Modelo descentralizado (bursting) | Modelo centralizado (federação) |
|---|---|---|
| Controle | Cada cluster operado individualmente | Control plane comum |
| Deployment | Repetido por ambiente | Uma origem, propagado |
| Consistência | Responsabilidade do operador | Garantida pelo controller |
| Complexidade inicial | Menor | Maior |
| Escala de operação | Degrada com o número de clusters | Constante |

## Características

- O control plane federado usa **APIs Kubernetes padrão** para operações cluster-wide.
- **DNS é gerenciado automaticamente** para todos os nós descobertos — clusters isolados têm entradas DNS próprias, e o KubeFed as coordena.
- Configuração específica de um member (políticas de rede locais, por exemplo) é **suplementada** pelo host cluster.
- Os pods de federação são pods comuns num federated service, responsáveis por deployment de serviço, health monitoring e gestão de DNS.
- Permite federar todas as primitivas: namespaces, services, deployments, ConfigMaps.

## Veja também

- [[Kubernetes (K8s)]]
- [[Hybrid Cloud]]
- [[Cloud Bursting]]
- [[Multi-Cloud]]
- [[Container Orchestration]]
