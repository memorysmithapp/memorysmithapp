---
title: Service Mesh
tags:
  - microservices
  - kubernetes
  - networking
type: concept
status: evergreen
created: 2026-07-09
---
Service Mesh é uma camada de infraestrutura responsável pela comunicação entre microsserviços.

Ela adiciona funcionalidades sem alterar o código das aplicações.

```mermaid
graph LR

A --> SidecarA
SidecarA --> SidecarB
SidecarB --> B
```

> [!info]
> O Service Mesh utiliza proxies sidecar para controlar o tráfego entre serviços.

## Funcionalidades

- mTLS
- Retry
- Circuit Breaker
- Load Balancing
- Observabilidade
- Rate Limiting

## Exemplos

- Istio
- Linkerd
- Consul Connect

## Veja também

- [[Microservices]]
- [[Sidecar Pattern]]
- [[Circuit Breaker]]