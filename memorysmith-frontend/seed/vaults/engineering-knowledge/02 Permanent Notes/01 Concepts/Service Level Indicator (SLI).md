---
title: Service Level Indicator (SLI)
aliases:
  - SLI
  - Indicador de Nível de Serviço
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
> SLI é a medida quantitativa bruta de um aspecto do serviço — latência, taxa de erro, disponibilidade — sobre a qual os objetivos são definidos.

## Conceito

O SLI é a matéria-prima. A escolha de qual grandeza medir determina tudo o que vem depois: um SLI de disponibilidade do servidor não diz nada sobre um serviço cujo problema é latência.

Bons SLIs medem a jornada do usuário — requisição bem-sucedida em tempo aceitável — e não a saúde da infraestrutura.

## Características

- Medida bruta, sem meta associada
- Deve refletir a experiência, não o componente
- Base para [[Service Level Objective (SLO)]] e [[Error Budget]]
- Coletado por [[Observability]] e [[Monitoring and Event Management]]

## Veja também

- [[Service Level Objective (SLO)]]
- [[Service Level Agreement (SLA)]]
- [[Observability]]
