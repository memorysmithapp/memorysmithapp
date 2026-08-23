---
title: Distributed Tracing
aliases:
  - Tracing
  - Rastreamento Distribuído
  - Trace
tags:
  - observability
  - microservices
  - operations
  - system-design
type: concept
status: evergreen
source: "BIG ARCHIVE: System Design 2023, ByteByteGo"
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
---
> [!abstract]
> Distributed Tracing é o acompanhamento de uma requisição individual ao longo de todos os componentes que ela atravessa, expondo onde o tempo foi gasto e onde a falha ocorreu.

## Conceito

O trace é *request-scoped*: seu recorte não é o serviço, é a **jornada**. Uma requisição que passa pelo [[API Gateway]], pelo [[Load Balancer]], pelo serviço A, pelo serviço B e pelo banco deixa em cada ponto um *span* — e a soma ordenada dos spans reconstrói o caminho completo.

Essa é a razão de existir: em [[Microservices]], nenhum log local contém a história inteira. Cada serviço só sabe da própria parte, e o gargalo pode estar em qualquer uma delas.

```mermaid
flowchart LR
    C[Cliente] --> GW[API Gateway]
    GW --> LB[Load Balancer]
    LB --> A[Serviço A]
    A --> B[Serviço B]
    B --> DB[(Banco)]
```

Cada seta acima é um span; o conjunto, identificado por um mesmo *trace ID*, é o trace.

## Características

- Depende de **propagação de contexto**: o trace ID precisa atravessar cada chamada, o que exige instrumentação em todos os serviços do caminho
- Uso principal é identificar **gargalos** — qual span consumiu a maior fatia da latência total
- **OpenTelemetry** é o framework que unifica os três pilares da [[Observability]] sob uma instrumentação única
- Costuma ser amostrado: guardar 100% dos traces raramente compensa em custo

> [!warning]
> Um único serviço não instrumentado no meio da cadeia cria um buraco no trace e leva a investigação a concluir que o problema está no serviço seguinte, que é apenas o próximo ponto visível.

## Veja também

- [[Observability]]
- [[Logging]]
- [[Microservices]]
- [[Service Mesh]]
- [[Latency Numbers]]
- [[Mean Time to Restore (MTTR)]]
