---
title: Error Budget
aliases:
  - Orçamento de Erro
tags:
  - itil
  - sre
  - metrics
type: concept
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
> [!abstract]
> Error Budget é a quantidade de indisponibilidade tolerada por um SLO em um período — o espaço de falha que a organização decidiu poder gastar.

## Conceito

O error budget resolve, com aritmética, a disputa política mais antiga da operação: entregar rápido ou manter estável. Se o SLO é 99,9% ao mês, há cerca de 43 minutos de falha permitidos. Enquanto sobra orçamento, o time entrega; quando acaba, o time estabiliza.

A elegância é que a regra é acordada **antes** da crise, quando ainda é possível discutir com racionalidade.

## Características

- Derivado diretamente do [[Service Level Objective (SLO)]]
- Converte confiabilidade em decisão de priorização
- Orçamento não gasto é sinal de SLO conservador demais
- Prática central de [[Site Reliability Engineering (SRE)]]

## Veja também

- [[Service Level Objective (SLO)]]
- [[Site Reliability Engineering (SRE)]]
- [[Reliability]]
- [[Change Enablement]]
