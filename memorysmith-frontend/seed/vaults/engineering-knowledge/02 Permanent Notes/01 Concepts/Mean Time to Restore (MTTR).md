---
title: Mean Time to Restore (MTTR)
aliases:
  - MTTR
  - Tempo Médio de Restauração
tags:
  - itil
  - metrics
  - operations
type: concept
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
> [!abstract]
> MTTR é o tempo médio entre a detecção de uma falha e a restauração do serviço.

## Conceito

MTTR é a métrica que melhor traduz a maturidade operacional, porque depende de tudo: detecção, alerta, conhecimento documentado, capacidade de reverter e clareza de responsabilidade.

Sua fraqueza é ser uma média — e incidentes têm distribuição de cauda longa. Um MTTR de 20 minutos pode esconder um incidente de 9 horas que definiu a percepção do ano inteiro. Percentis contam a história real.

## Características

- Depende de detecção, não só de correção
- Reduzido drasticamente por [[Known Error]] documentado
- Média engana: use também p90 e o pior caso
- Uma das quatro [[DORA Metrics]]

## Veja também

- [[Incident Management]]
- [[DORA Metrics]]
- [[Observability]]
- [[Availability]]
