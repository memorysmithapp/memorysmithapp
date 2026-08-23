---
title: Event Streaming Platform
aliases:
  - Plataforma de Streaming de Eventos
  - Log de Eventos Distribuído
  - Kafka
tags:
  - distributed-systems
  - messaging
  - streaming
  - system-design
type: concept
status: evergreen
source: "BIG ARCHIVE: System Design 2023, ByteByteGo"
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
---
> [!abstract]
> Event Streaming Platform é um log distribuído, particionado e append-only que retém eventos por um período configurado, permitindo que múltiplos consumidores os leiam de forma independente e em seu próprio ritmo.

## Conceito

A diferença para uma [[Message Queue]] tradicional é o que acontece **depois** da leitura. Na fila clássica, a mensagem consumida some. No log de eventos, ela permanece: cada consumidor mantém seu próprio *offset*, pode reprocessar do início e novos consumidores podem ser adicionados sem coordenação com os existentes. É o que torna o mesmo fluxo reutilizável por analytics, auditoria e serviços operacionais ao mesmo tempo.

## Estrutura

```mermaid
flowchart LR
    P[Producer] --> T[Topic]
    T --> P0[Partition 0]
    T --> P1[Partition 1]
    P0 --> CG1[Consumer Group A]
    P1 --> CG1
    P0 --> CG2[Consumer Group B]
```

Producer, broker, topic, partition e consumer group são os cinco elementos do modelo. A **partição** é a unidade de paralelismo e a única fronteira dentro da qual a ordem é garantida.

## Por que é rápido

Duas decisões de projeto respondem pela maior parte do desempenho:

1. **I/O sequencial.** A escrita é sempre no fim do log, transformando acesso aleatório em escrita sequencial — o padrão em que o disco é mais rápido.
2. **Zero copy.** Sem ele, o dado é copiado do OS cache para a aplicação, dela para o socket buffer e só então para a placa de rede. Com `sendfile()`, o OS cache entrega direto à placa de rede, eliminando as cópias entre contexto de kernel e de aplicação.

```mermaid
flowchart LR
    subgraph Sem zero copy
    D1[Disco] --> O1[OS cache] --> A1[Aplicação] --> S1[Socket buffer] --> N1[Placa de rede]
    end
    subgraph Com zero copy
    D2[Disco] --> O2[OS cache] -->|sendfile| N2[Placa de rede]
    end
```

## Características

- Retenção por tempo ou tamanho, independente do consumo
- Reprocessamento por reposicionamento de offset
- Ordem garantida por partição, nunca por tópico
- Base natural para [[Event Sourcing]] e para arquiteturas orientadas a eventos

## Veja também

- [[Message Queue]]
- [[Event Sourcing]]
- [[Microservices]]
- [[Latency Numbers]]
- [[Object Storage]]
