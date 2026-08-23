---
title: Service Level Objective (SLO)
aliases:
  - SLO
  - Objetivo de Nível de Serviço
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
> SLO é a meta interna de confiabilidade definida sobre um indicador de nível de serviço, usada para decidir quando priorizar estabilidade sobre novas funcionalidades.

## Conceito

O SLO é mais rigoroso que o [[Service Level Agreement (SLA)]] por desenho: ele dispara ação antes de o contrato ser violado. Sua função não é reportar, é **decidir** — quando o SLO é ameaçado, o time redireciona esforço para confiabilidade.

É a base do [[Error Budget]], que transforma essa decisão em regra explícita em vez de negociação política.

## Características

- Meta interna, mais estrita que o SLA
- Define quando parar de entregar features e estabilizar
- Deve refletir a experiência do usuário, não a saúde do componente
- 100% nunca é um SLO válido — elimina a margem de mudança

## Veja também

- [[Service Level Agreement (SLA)]]
- [[Service Level Indicator (SLI)]]
- [[Error Budget]]
- [[Site Reliability Engineering (SRE)]]
