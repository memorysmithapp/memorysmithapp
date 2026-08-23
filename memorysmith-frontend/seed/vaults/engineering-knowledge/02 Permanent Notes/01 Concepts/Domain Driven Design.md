---
title: Domain Driven Design
aliases:
  - DDD
  - Domain-Driven Design
  - Design Orientado a Domínio
tags:
  - architecture
  - design
  - software
type: concept
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
> [!abstract]
> Domain-Driven Design é a abordagem de design de software que estrutura o sistema a partir do domínio de negócio, usando linguagem ubíqua e fronteiras explícitas de contexto.

## Conceito

A contribuição estratégica do DDD é o **bounded context**: reconhecer que o mesmo termo significa coisas diferentes em partes diferentes do negócio, e que tentar unificá-lo num modelo único produz o acoplamento que ninguém consegue desfazer depois.

A ponte com o ITIL é direta: bounded contexts, [[Business Capability]] e fronteiras de [[Product]] tendem a coincidir — e quando não coincidem, a divergência costuma ser exatamente onde a organização sente mais atrito.

## Conceitos centrais

- Linguagem ubíqua compartilhada entre negócio e código
- Bounded context como fronteira de significado
- Context map descrevendo relações entre contextos
- Blocos táticos: agregado, entidade, objeto de valor, evento de domínio

## Veja também

- [[Event Storming]]
- [[Business Capability]]
- [[Lei de Conway]]
- [[Team Topologies]]
- [[Architecture Management]]
