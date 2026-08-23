---
title: DevSecOps
aliases:
tags:
  - devops
  - security
  - engineering
type: concept
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
> [!abstract]
> DevSecOps é a extensão do DevOps que integra segurança em todas as etapas do fluxo, em vez de tratá-la como portão de aprovação no fim.

## Conceito

A premissa é aritmética: corrigir uma falha de segurança em desenho custa ordens de grandeza menos que corrigi-la em produção. Manter a segurança como revisão final garante que ela sempre chegue no momento mais caro e com menos poder de mudar decisões estruturais.

Deslocar segurança para a esquerda ("shift left") só funciona com automação — revisão manual em cada commit não escala.

## Características

- Segurança automatizada no pipeline: dependências, segredos, código, imagem
- Time de segurança como habilitador, não como portão
- Ameaça modelada em [[Design (Lifecycle)]], não auditada depois
- Complementa [[Information Security Management]]

## Veja também

- [[DevOps]]
- [[Information Security Management]]
- [[Continuous Delivery (CD)]]
- [[Compliance]]
