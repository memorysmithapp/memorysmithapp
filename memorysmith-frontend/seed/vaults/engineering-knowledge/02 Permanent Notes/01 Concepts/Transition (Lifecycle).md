---
title: Transition (Lifecycle)
aliases:
  - Transition
  - Transição
tags:
  - itil
  - lifecycle
  - release
type: concept
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
> [!abstract]
> Transition é a atividade do ciclo de vida em que o produto ou serviço é movido com segurança do ambiente de construção para o de produção.

## Conceito

Transição é onde risco de mudança e velocidade de entrega se encontram. O objetivo não é minimizar mudanças, é minimizar o **impacto** de mudanças — o que se consegue reduzindo o tamanho do lote, não a frequência.

Também é onde se decide se o serviço está de fato pronto para ser operado: documentação, runbooks, alertas e capacidade de suporte fazem parte do critério de prontidão, não são pendências pós-go-live.

## Atividades típicas

- Planejar e autorizar mudanças ([[Change Enablement]])
- Empacotar e liberar versões ([[Release Management]])
- Implantar em produção ([[Deployment Management]])
- Verificar prontidão operacional e de suporte

## Características

- Lotes menores reduzem risco mais do que aprovações adicionais
- Prontidão operacional é critério de entrada, não pendência
- Precisa de caminho de reversão testado, não apenas documentado

## Veja também

- [[ITIL Product and Service Lifecycle]]
- [[Change Enablement]]
- [[Release Management]]
- [[Deployment Management]]
- [[Continuous Delivery (CD)]]
