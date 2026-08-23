---
title: Reliability
aliases:
  - Confiabilidade
tags:
  - itil
  - metrics
  - operations
type: concept
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
> [!abstract]
> Reliability é a probabilidade de um serviço executar sua função corretamente por um período determinado, sem falhar.

## Conceito

Disponibilidade e confiabilidade são frequentemente usadas como sinônimos e não são. Um serviço pode ter alta disponibilidade e baixa confiabilidade: cai constantemente, mas volta rápido. Do ponto de vista do usuário no meio de uma tarefa, isso é péssimo — e o painel de disponibilidade não mostra.

## Comparação

| | [[Availability]] | [[Reliability]] |
|---|---|---|
| Pergunta | Está no ar agora? | Consigo terminar minha tarefa? |
| Métrica típica | % de uptime | MTBF, taxa de sucesso de requisição |
| Falha característica | Queda longa | Falhas curtas e frequentes |

## Veja também

- [[Availability]]
- [[Site Reliability Engineering (SRE)]]
- [[Error Budget]]
- [[Warranty]]
