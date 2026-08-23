---
title: ByteByteGo System Design Archive 01
aliases:
  - "Parte 1: Sistemas Distribuídos e Escalabilidade"
tags:
  - system-design
  - distributed-systems
  - scalability
  - caching
  - messaging
type: literature
status: evergreen
source: "BIG ARCHIVE: System Design 2023, ByteByteGo"
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
chapter: 1
---
## Parte 1: Sistemas Distribuídos e Escalabilidade

Reúne os tópicos do arquivo que tratam de **como um sistema absorve carga**: distribuição de dados, distribuição de tráfego, cache, mensageria e os números que limitam qualquer decisão de arquitetura.

## Resumo executivo

O fio condutor é sempre o mesmo: quando um único nó deixa de dar conta, ou se **particiona o dado** (sharding), ou se **replica o processamento** (load balancing), ou se **evita o trabalho** (cache), ou se **desacopla no tempo** (filas). Cada estratégia tem um custo — de consistência, de operação ou de complexidade — e o arquivo insiste em apresentá-los lado a lado em vez de eleger um vencedor.

## Principais ideias

- **Sharding é uma decisão de roteamento, não de armazenamento.** As três estratégias (range, key/hash, directory) diferem em como se descobre *onde* o dado está, e é isso que determina o custo de rebalancear.
- **Balanceamento estático × dinâmico.** Round-robin e hash não olham para o estado dos destinos; least-connections e least-response-time olham. Algoritmos estáticos exigem serviços stateless para funcionar bem.
- **Cache é um problema de sincronização.** Introduzir cache não é uma otimização isolada: cria um segundo lugar onde a verdade mora, e as cinco estratégias são cinco respostas diferentes para quem escreve primeiro.
- **Kafka é rápido por duas decisões, não por mágica.** I/O sequencial em disco e o princípio *zero copy* (`sendfile()`), que elimina as cópias entre contexto de kernel e contexto de aplicação.
- **A evolução IBM MQ → RabbitMQ → Kafka → Pulsar** é a migração de "entrega de mensagem" para "log de eventos", e depois para arquitetura nativamente elástica com armazenamento em camadas.
- **Números de latência são a régua.** Sem saber que RAM é ~100 ns e uma travessia intercontinental é ~100 ms — seis ordens de grandeza — não há como avaliar um desenho.

> [!quote]
> "Zero copy is a shortcut to save multiple data copies between the application context and kernel context."

## Conceitos apresentados

- [[Database Sharding]] — range, key/hash e directory-based
- [[Database Index]] — as estruturas de dados que sustentam o índice
- [[Load Balancer]] — algoritmos estáticos e dinâmicos
- [[Content Delivery Network (CDN)]]
- [[API Gateway]]
- [[Service Discovery]]
- [[Message Queue]] — critérios de seleção e a linhagem IBM MQ → Pulsar
- [[Event Streaming Platform]] — Kafka, sequential I/O e zero copy
- [[Distributed ID Generator]] — UUID, Snowflake e variantes
- [[Latency Numbers]]
- [[DNS Routing Policy]]
- [[Estratégias de Cache]] — cache-aside, read-through, write-around, write-back, write-through

## Exemplos

- **Redis** persiste com AOF (log de comandos, *write-after log*) e RDB (snapshot via `fork` do processo `bgsave`); em produção o comum é o modo misto.
- **Uber** usa DocStore (MySQL/PostgreSQL sobre RocksDB) no OLTP, Pinot e AresDB para séries temporais, Kafka e Flink no streaming.
- **Levels.fyi** escalou para milhões de usuários usando Google Sheets como backend — lembrete de que a escala exigida é sempre menor do que a imaginada.

---
Ref: [[ByteByteGo System Design Archive]], [[CAP Theorem]], [[Distributed Cache]], [[Event Sourcing]], [[System Design MOC]]
