---
title: Stateful vs Stateless
aliases:
  - Serviço Stateful
  - Serviço Stateless
  - Com Estado e Sem Estado
tags:
  - architecture
  - distributed-systems
  - high-availability
  - scalability
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Distinção entre serviços que dependem de dados de requisições anteriores (stateful) e os que tratam cada requisição isoladamente (stateless).

## Conceito

Um serviço **stateless** não guarda nada entre requisições. Qualquer instância pode atender qualquer chamada, e a falha de uma não afeta o sistema — outra assume sem cerimônia.

Um serviço **stateful** depende de dados anteriores e interage sincronamente para preservar consistência. Sua falha propaga: o estado precisa ser recuperado, replicado ou reconstruído.

## Características

Essa é a distinção que **determina o padrão de alta disponibilidade**:

| | Stateless | Stateful |
|---|---|---|
| Escala | Horizontal trivial, atrás de load balancer | Exige replicação e consenso |
| Padrão de HA | [[Active-Active vs Active-Passive\|Active/active]] direto | Cluster com quórum ou eleição de líder |
| Falha de nó | Transparente | Requer failover coordenado |
| Complexidade | Baixa | Alta |
| Exemplos | APIs REST, schedulers, agentes, proxies | Bancos, filas, caches persistentes, sistemas de arquivo |

> [!tip] Empurre o estado para as bordas
> A estratégia arquitetural recorrente é concentrar o estado em poucos componentes especializados (banco, fila, cache) e manter tudo o mais stateless. Reduz-se o número de peças que exigem tratamento caro de disponibilidade.

## Exemplo — OpenStack

**Stateless:** APIs, schedulers, agentes e conductors de todos os serviços — computação, rede, imagem, monitoramento, storage.

**Stateful:** o banco de dados (resolvido com [[Galera Cluster]]) e a fila de mensagens (resolvida com [[Quorum Queue]]).

## Veja também

- [[Active-Active vs Active-Passive]]
- [[High Availability]]
- [[Control Plane]]
- [[Consensus]]
