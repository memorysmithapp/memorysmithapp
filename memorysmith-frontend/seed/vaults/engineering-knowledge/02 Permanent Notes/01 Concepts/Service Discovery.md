---
title: Service Discovery
aliases:
  - Service Registry
  - Descoberta de Serviços
tags:
  - microservices
  - architecture
  - distributed-systems
  - system-design
type: concept
status: evergreen
source: "BIG ARCHIVE: System Design 2023, ByteByteGo"
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
---
> [!abstract]
> Service Discovery é o mecanismo pelo qual um serviço descobre, em tempo de execução, o endereço das instâncias com as quais precisa se comunicar.

## Conceito

Em um ambiente elástico, instâncias nascem, morrem e mudam de endereço o tempo todo — é exatamente o comportamento desejado em contêineres e autoescala. Endereços fixos em configuração deixam de funcionar nesse regime, e a resposta é inverter a lógica: cada instância **se registra** ao subir, e quem precisa dela **consulta o registro**.

## Fluxo

```mermaid
flowchart LR
    S1[Instância do serviço] -->|1. registra-se| R[(Service Registry)]
    G[API Gateway / Cliente] -->|2. consulta| R
    R -->|3. endereços saudáveis| G
    G -->|4. chamada| S1
```

## Características

- O registro mantém *health checks*: instância que não responde é removida do conjunto elegível
- **Client-side discovery** — o cliente consulta o registro e escolhe a instância
- **Server-side discovery** — um intermediário (gateway, balanceador, [[Service Mesh]]) consulta por ele
- Em [[Kubernetes (K8s)]] a função é nativa: o recurso Service e o DNS interno do cluster fazem esse papel

> [!important]
> Service Discovery e [[Load Balancer]] resolvem perguntas diferentes que costumam ser confundidas: descoberta responde *quais instâncias existem*; balanceamento responde *qual delas recebe esta requisição*.

## Veja também

- [[Microservices]]
- [[API Gateway]]
- [[Service Mesh]]
- [[Kubernetes (K8s)]]
- [[Load Balancer]]
