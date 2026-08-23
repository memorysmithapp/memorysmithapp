---
title: Service Level Agreement (SLA)
aliases:
  - SLA
  - Acordo de Nível de Serviço
tags:
  - itil
  - service-level
  - metrics
type: concept
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
> [!abstract]
> SLA é o acordo documentado entre provedor e consumidor que define os níveis de serviço esperados e as consequências do não cumprimento.

## Conceito

O SLA é útil quando mede o que o consumidor sente e inútil quando mede o que é fácil coletar. O anti-padrão clássico tem nome: **watermelon SLA** — verde por fora, vermelho por dentro. Todos os indicadores dentro da meta, todos os usuários insatisfeitos.

Isso acontece quando o SLA mede componentes em vez de serviço, e médias em vez de experiência.

## Características

- Negociado com o [[Customer]], sustentado perante o [[User]]
- Deve medir o serviço ponta a ponta, não componentes
- Percentis revelam o que médias escondem
- Gerido por [[Service Level Management]]

## Comparação

| | [[Service Level Agreement (SLA)]] | [[Service Level Objective (SLO)]] | [[Service Level Indicator (SLI)]] |
|---|---|---|---|
| Natureza | Acordo contratual | Meta interna | Medição bruta |
| Público | Consumidor | Time de engenharia | Sistema |
| Consequência | Contratual | Priorização de trabalho | Nenhuma |

## Veja também

- [[Service Level Management]]
- [[Service Level Objective (SLO)]]
- [[Service Quality]]
- [[Warranty]]
