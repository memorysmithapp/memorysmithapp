---
title: Build (Lifecycle)
aliases:
  - Build
  - Construção
tags:
  - itil
  - lifecycle
  - engineering
type: concept
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
> [!abstract]
> Build é a atividade do ciclo de vida em que os componentes do produto digital são codificados, configurados, integrados e testados.

## Conceito

Build não termina em "funciona na minha máquina" — termina em evidência de que o componente é confiável, observável e implantável. É por isso que [[Continuous Integration (CI)]] e testes automatizados são tratados como parte da atividade e não como ferramental opcional.

O erro recorrente é medir Build por velocidade de entrega isolada. Velocidade que empurra defeito para [[Support (Lifecycle)]] não é velocidade; é transferência de custo.

## Atividades típicas

- Desenvolver, configurar e integrar componentes
- Automatizar build e testes ([[Continuous Integration (CI)]])
- Instrumentar para [[Observability]] antes de ir a produção
- Validar contra os requisitos definidos em [[Design (Lifecycle)]]

## Características

- Produz artefato implantável e evidência de qualidade
- Conectada diretamente a [[Deliver (Lifecycle)]], não isolada dela
- Governada por [[Software Development and Management]]

## Veja também

- [[ITIL Product and Service Lifecycle]]
- [[Acquire (Lifecycle)]]
- [[Software Development and Management]]
- [[Continuous Integration (CI)]]
- [[Service Validation and Testing]]
