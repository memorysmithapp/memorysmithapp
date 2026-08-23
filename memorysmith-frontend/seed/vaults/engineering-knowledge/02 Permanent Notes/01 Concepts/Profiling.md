---
title: Profiling
aliases:
  - Profiler
  - Perfilamento
tags:
  - performance
  - observability
  - debugging
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Técnica de instrumentar a execução para descobrir onde exatamente o tempo e os recursos são consumidos ao longo de uma requisição ou processo.

## Conceito

Num sistema distribuído, saber que uma operação demora oito segundos é inútil sem saber **onde** os oito segundos foram gastos. Log e métrica não respondem isso: falta a noção de fluxo de requisição.

O profiling reconstrói esse fluxo. Ele mostra a sequência de chamadas, suas durações e suas dependências — e, com isso, o gargalo aparece nominalmente, não por inferência.

## Características

- Captura tempo de resposta de **API, banco, driver e chamada RPC**.
- Produz uma **linha do tempo** e um mapa de serviços, útil para análise posterior.
- Traces podem ser persistidos para comparação entre condições diferentes — é a comparação que revela regressão.
- Aplicado a código, o profiling mede CPU, alocação de memória e chamadas de função; aplicado a infraestrutura, mede saltos entre serviços.

## Comparação

| | [[Distributed Tracing]] | Profiling | [[Benchmarking]] |
|---|---|---|---|
| Escopo | Requisição atravessando serviços | Execução detalhada de um caminho | Sistema sob carga |
| Quando | Contínuo em produção | Sob demanda, investigativo | Antes de promover mudança |
| Saída | Span tree | Linha do tempo com durações | Relatório agregado + SLA |

Na prática, tracing distribuído e profiling de infraestrutura se sobrepõem bastante — o [[OSProfiler]] é os dois ao mesmo tempo.

## Veja também

- [[OSProfiler]]
- [[Distributed Tracing]]
- [[Benchmarking]]
- [[Observability]]
