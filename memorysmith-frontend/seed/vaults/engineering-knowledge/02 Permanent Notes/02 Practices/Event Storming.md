---
title: Event Storming
aliases:
tags:
  - architecture
  - design
  - workshop
type: practice
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
Event Storming é o workshop colaborativo, criado por Alberto Brandolini, que mapeia um domínio de negócio a partir dos eventos que nele ocorrem, reunindo negócio e tecnologia na mesma parede.

## Dinâmica / Passo a Passo

1. Reunir quem conhece o negócio e quem constrói o software na mesma sala
2. Levantar os eventos de domínio em post-its laranja, no passado ("Pedido Confirmado")
3. Ordenar cronologicamente e resolver as divergências que aparecem
4. Marcar os pontos de tensão (hotspots) em rosa — dúvidas e contradições
5. Adicionar comandos, atores, agregados e políticas
6. Identificar os eventos-pivô que sugerem fronteiras de contexto

## Regras

- Evento sempre no passado; comando sempre no imperativo
- Ninguém corrige ninguém na fase de levantamento
- Divergência entre participantes é o resultado mais valioso do workshop, não um problema
- Parede infinita: sem limite de espaço, sem limite de escopo inicial

## Exemplo

Um Event Storming de um fluxo de pagamento costuma revelar que "Pagamento" significa autorização para um time e liquidação para outro — a fronteira de contexto aparece exatamente ali.

---
Ref: [[Domain Driven Design]], [[Business Capability]], [[Value Stream Mapping]], [[Discover (Lifecycle)]]
