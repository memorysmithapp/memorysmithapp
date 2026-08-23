---
title: Site Reliability Engineering (SRE)
aliases:
  - SRE
  - Engenharia de Confiabilidade
tags:
  - itil
  - sre
  - engineering
  - operations
type: concept
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
> [!abstract]
> SRE é a disciplina que aplica engenharia de software à operação de infraestrutura e serviços, tratando confiabilidade como funcionalidade e definindo-a por objetivos mensuráveis.

## Conceito

A premissa do SRE é que confiabilidade não se obtém com mais processo de aprovação, mas com automação, instrumentação e um contrato numérico sobre quanto de falha é aceitável — o [[Error Budget]].

Em relação ao ITIL, SRE não compete: ele **implementa**. Onde o ITIL diz "gerencie disponibilidade e responda a incidentes", o SRE oferece o mecanismo concreto: SLI, SLO, orçamento de erro, limite de trabalho manual (toil) e postmortem sem culpa.

## Características

- Confiabilidade tratada como requisito de produto
- Trabalho manual repetitivo (toil) limitado por política
- Postmortem sem culpa como prática obrigatória
- Decisões de priorização governadas por [[Error Budget]]

## Comparação

| | ITIL | SRE |
|---|---|---|
| Natureza | Framework de gestão | Prática de engenharia |
| Escopo | Ciclo de vida completo | Confiabilidade em produção |
| Sobre incidentes | Restaurar e prevenir recorrência | Restaurar, medir orçamento, automatizar |
| Relação | Define o quê | Fornece o como |

## Veja também

- [[Service Level Objective (SLO)]]
- [[Error Budget]]
- [[Observability]]
- [[Reliability]]
- [[DevOps]]
- [[Availability Management]]
