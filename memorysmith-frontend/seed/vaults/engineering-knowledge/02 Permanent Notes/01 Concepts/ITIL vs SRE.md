---
title: ITIL vs SRE
aliases:
  - ITIL e SRE
tags:
  - itil
  - sre
  - comparison
type: concept
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
> [!abstract]
> O SRE pode ser lido como uma implementação técnica e mensurável dos objetivos operacionais do ITIL — não como uma alternativa a ele.

## Comparação

| | ITIL | SRE |
|---|---|---|
| Natureza | Framework de gestão | Prática de engenharia |
| Escopo | Ciclo de vida completo | Confiabilidade em produção |
| Define confiabilidade | Por acordo ([[Service Level Agreement (SLA)]]) | Por objetivo numérico ([[Service Level Objective (SLO)]]) |
| Sobre incidente | Restaurar e prevenir recorrência | Restaurar, medir orçamento, automatizar |
| Sobre trabalho manual | Não trata explicitamente | Limita toil por política |
| Sobre risco de mudança | Autorização por classe | [[Error Budget]] como regra automática |

## A complementaridade

Onde o ITIL diz "gerencie disponibilidade", o SRE responde com SLI, SLO e orçamento de erro. Onde o ITIL diz "aprenda com incidentes", o SRE responde com postmortem sem culpa. O ITIL define **o quê** com abrangência; o SRE define **o como** com profundidade — em um recorte estreito.

O que o SRE não cobre: portfólio, fornecedor, financeiro, relacionamento, catálogo, continuidade de negócio.

## Veja também

- [[Site Reliability Engineering (SRE)]]
- [[Error Budget]]
- [[Availability Management]]
- [[ITIL vs DevOps]]
