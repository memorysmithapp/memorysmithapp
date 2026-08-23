---
title: Centralized Logging
aliases:
  - Logging Centralizado
  - Pipeline de Logs
  - Log Aggregation
tags:
  - observability
  - logging
  - operations
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Prática de coletar, transportar, parsear e indexar os logs de todos os componentes de um sistema num único ponto pesquisável.

## Conceito

Num sistema com dezenas de serviços distribuídos em dezenas de nós, o log local é inútil na prática: encontrar a causa de um problema exige correlacionar arquivos em máquinas diferentes, num momento em que ninguém tem tempo para isso.

A centralização inverte o problema — a busca vira consulta, e não expedição.

O pré-requisito é o **log estruturado**. Log em texto livre pode ser centralizado, mas não parseado com confiabilidade; é a estrutura que permite filtrar por campo, agregar por severidade e construir métrica derivada.

## Características

Um pipeline maduro tem quatro estágios:

1. **Coleta** — agente em cada nó lendo os arquivos ou o stdout dos containers (Fluentd, Filebeat, rsyslog).
2. **Transporte** — envio confiável ao destino, com buffer.
3. **Parse e indexação** — extração de campos e criação de índices pesquisáveis.
4. **Consulta e visualização** — busca, filtro por campo e agregação em gráficos.

**Retenção em duas fases** é o padrão para controlar custo:

| Fase | O que acontece |
|---|---|
| **Soft** | O índice é fechado, deixa de ser ativo, mas ainda ocupa disco e pode ser reaberto |
| **Hard** | O índice é apagado permanentemente |

## Exemplo

Stacks comuns: **ELK** (Elasticsearch, Logstash, Kibana), **OpenSearch** (fork open source do Elasticsearch sob Apache 2.0), e comerciais como Datadog e Splunk.

Papéis de nó num cluster OpenSearch: **cluster manager** (estado, saúde, alocação de shard — mínimo dois em produção), **coordinator** (recebe, delega, agrega, devolve) e **data node** (armazena e executa indexação, agregação e busca).

> [!tip] Dimensione por papel
> Data nodes pedem disco rápido e IOPS alto. Manager e coordinator pedem CPU. Tratá-los como nós idênticos desperdiça nos dois sentidos.

## Veja também

- [[Logging]]
- [[Observability]]
- [[Distributed Tracing]]
- [[Metrics]]
