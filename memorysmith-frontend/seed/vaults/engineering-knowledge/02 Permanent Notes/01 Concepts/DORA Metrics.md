---
title: DORA Metrics
aliases:
  - DORA
  - Four Key Metrics
tags:
  - itil
  - metrics
  - devops
type: concept
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
> [!abstract]
> As DORA Metrics são quatro indicadores de desempenho de entrega de software que, juntos, equilibram velocidade e estabilidade.

## As quatro métricas

| Métrica | Mede | Eixo |
|---|---|---|
| **Deployment Frequency** | Com que frequência se entrega em produção | Velocidade |
| **Lead Time for Changes** | Do commit ao funcionamento em produção | Velocidade |
| **Change Failure Rate** | % de mudanças que causam degradação | Estabilidade |
| **Time to Restore Service** | Tempo para restaurar após falha | Estabilidade |

## Conceito

O valor do conjunto está na tensão embutida: duas métricas puxam para velocidade, duas para estabilidade. Otimizar qualquer par isolado é trivial e inútil — entregar uma vez por trimestre zera a taxa de falha e destrói o negócio.

A descoberta contraintuitiva da pesquisa é que velocidade e estabilidade **não são trade-off**: times de alto desempenho são melhores nas quatro simultaneamente, porque lotes pequenos reduzem risco.

## Veja também

- [[Metrics]]
- [[DevOps]]
- [[Mean Time to Restore (MTTR)]]
- [[Continuous Delivery (CD)]]
- [[Change Enablement]]
