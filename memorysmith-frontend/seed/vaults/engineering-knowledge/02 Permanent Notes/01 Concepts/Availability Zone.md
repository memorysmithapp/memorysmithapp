---
title: Availability Zone
aliases:
  - AZ
  - Zona de Disponibilidade
  - Fault Domain
tags:
  - high-availability
  - cloud
  - infrastructure
  - resilience
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Agrupamento lógico de recursos que compartilham um mesmo **domínio de falha físico** — tipicamente energia, rede de topo de rack ou localização.

## Conceito

A AZ existe para tornar a falha física **previsível e contornável**. Se todas as réplicas de uma aplicação vivem no mesmo rack, uma falha de PDU ou de switch ToR derruba todas. Distribuí-las entre AZs converte falha total em falha parcial.

O que amarra uma AZ é o mundo físico: ID do rack, localização, unidade de distribuição de energia. É por isso que **um nó de computação pertence a exatamente uma AZ** — ele está preso ao rack em que foi instalado.

## Características

- Uma **região** pode conter múltiplas AZs.
- No OpenStack, a abstração cobre não só computação, mas também **rede e block storage**.
- O usuário escolhe em qual AZ lançar a instância — o que torna o acompanhamento de utilização por AZ uma obrigação operacional.
- É a base do agendamento com anti-afinidade para workloads que exigem SLA alto.

## Comparação

| | [[Availability Zone]] | [[Host Aggregate]] | Região |
|---|---|---|---|
| Critério | Domínio de falha físico | Metadado de hardware | Deployment independente |
| Exclusividade | Um nó → uma AZ | Um nó → várias | Isolamento total |
| Natureza | Física | Lógica | Operacional |
| Custo | Baixo | Baixo | Alto (control plane próprio) |

## Veja também

- [[High Availability]]
- [[Host Aggregate]]
- [[Affinity e Anti-Affinity]]
- [[Disaster Recovery]]
