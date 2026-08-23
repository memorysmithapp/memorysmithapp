---
title: Aodh
aliases:
  - OpenStack Alarming Service
  - Alarming Service
tags:
  - openstack
  - alerting
  - telemetry
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Serviço de alarme do OpenStack: dispara ações a partir de limiares sobre métricas coletadas ou de eventos no barramento de mensagens.

## Conceito

Fork do módulo de alarme do [[Ceilometer]] a partir do release **Liberty**. A separação trouxe duas capacidades que o predecessor não tinha: **escala horizontal** sob carga, e resposta a evento com latência praticamente zero.

## Estrutura

| Componente | Papel |
|---|---|
| `aodh-api` | Acesso ao data store |
| `aodh-evaluator` | Dispara quando a tendência estatística cruza um limiar no período |
| `aodh-listener` | Dispara por regra sobre eventos reportados pelos agentes de notificação |
| `aodh-notifier` | Alarme por limiar sobre uma coleção de amostras |

Suporta alarmes **por evento** e **por limiar**; consulta as medições do [[Gnocchi]] por padrão.

## Características

O listener no mesmo barramento de mensagens é o que permite reagir instantaneamente — o caso canônico é acionar condições de **autoscaling** num serviço de orquestração como o Heat.

## Veja também

- [[Ceilometer]]
- [[Gnocchi]]
- [[Monitoring and Event Management]]
