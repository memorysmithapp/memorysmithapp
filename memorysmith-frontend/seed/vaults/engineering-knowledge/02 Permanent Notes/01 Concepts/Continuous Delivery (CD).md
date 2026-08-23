---
title: Continuous Delivery (CD)
aliases:
  - CD
  - Entrega Contínua
  - Continuous Deployment
tags:
  - itil
  - engineering
  - devops
type: concept
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
> [!abstract]
> Continuous Delivery é a prática de manter o software sempre em estado implantável, permitindo levar qualquer versão validada a produção a qualquer momento.

## Conceito

CD desloca a decisão de entregar: de "podemos tecnicamente?" para "queremos agora?". Isso remove a janela de release como evento de risco e substitui por fluxo contínuo de lotes pequenos.

A distinção com *continuous deployment* é o gatilho final: em delivery, alguém decide promover; em deployment, a promoção é automática após os testes.

## Características

- Software sempre implantável, com pipeline automatizado
- Lotes pequenos reduzem risco mais que aprovações adicionais
- Exige reversão testada, não apenas documentada
- Reconfigura [[Change Enablement]] para autorização por classe de risco

## Veja também

- [[Continuous Integration (CI)]]
- [[Deployment Management]]
- [[Release Management]]
- [[Transition (Lifecycle)]]
- [[DORA Metrics]]
