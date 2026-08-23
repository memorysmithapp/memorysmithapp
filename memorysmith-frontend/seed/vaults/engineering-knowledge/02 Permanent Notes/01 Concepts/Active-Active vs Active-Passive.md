---
title: Active-Active vs Active-Passive
aliases:
  - Active/Active
  - Active/Passive
  - Ativo-Ativo e Ativo-Passivo
tags:
  - high-availability
  - clustering
  - architecture
  - resilience
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Dois padrões de cluster: no active/active todos os nós processam requisições simultaneamente; no active/passive nós em espera só assumem quando o ativo falha.

## Comparação

| | Active/Active | Active/Passive |
|---|---|---|
| Clustering | Assimétrico | Simétrico |
| Ponto de entrada | Load balancer distribui | Não requer LB |
| Nós ociosos | Nenhum | Os standby ("sleepy watchers") |
| Ganho | Performance **e** disponibilidade | Só disponibilidade |
| Coordenação | O LB decide, se tiver a capacidade | Resource manager garante um único ativo |
| Custo por disponibilidade | Melhor | Pior |
| Risco típico | Conflito de escrita concorrente | Tempo de failover |

## Conceito

A escolha decorre quase inteiramente de [[Stateful vs Stateless]]:

- Serviço **stateless** escala em active/active sem esforço — basta pôr um [[Load Balancer]] na frente.
- Serviço **stateful** exige que alguém garanta a coerência. Ou se resolve o conflito de escrita (Galera, quorum), ou se aceita active/passive com um gerenciador de recursos arbitrando.

> [!important] Active/passive não é desperdício automático
> Em serviços onde a escrita concorrente é cara ou perigosa de reconciliar, manter um nó ocioso pode ser mais barato que resolver o conflito. O nó parado é o preço da consistência.

## Exemplo — OpenStack

A maioria das arquiteturas de referência adota **active/active**, porque o control plane é majoritariamente stateless. A implementação usa **HAProxy** para balanceamento e **Keepalived** para health check dinâmico sobre um **VIP** — ver [[VRRP]].

## Veja também

- [[High Availability]]
- [[Stateful vs Stateless]]
- [[Load Balancer]]
- [[VRRP]]
- [[Failover]]
