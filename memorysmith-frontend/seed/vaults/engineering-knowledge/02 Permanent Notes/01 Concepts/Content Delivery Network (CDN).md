---
title: Content Delivery Network (CDN)
aliases:
  - CDN
  - Rede de Distribuição de Conteúdo
tags:
  - networking
  - performance
  - scalability
  - system-design
type: concept
status: evergreen
source: "BIG ARCHIVE: System Design 2023, ByteByteGo"
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
---
> [!abstract]
> CDN é um conjunto de servidores geograficamente distribuídos que armazenam conteúdo estático perto do usuário final, encurtando a distância física que a resposta precisa percorrer.

## Conceito

A latência de rede é limitada pela velocidade da luz, não pela engenharia: uma travessia Califórnia–Holanda–Califórnia custa cerca de **100 ms** e nenhum código elimina isso. A CDN ataca o problema pelo único lado disponível — reduzindo a distância, replicando o conteúdo em pontos de presença espalhados pelo mundo.

## Fluxo

```mermaid
flowchart LR
    U[Usuário] --> E[Edge / PoP mais próximo]
    E -->|cache hit| U
    E -->|cache miss| O[Origem]
    O --> E
```

O cliente consulta a CDN primeiro; só quando o conteúdo não está no *edge* a requisição segue para o backend de origem.

## Características

- Alivia o backend de todo o tráfego de conteúdo estático — imagens, vídeo, JS, CSS
- Absorve picos e parte dos ataques volumétricos antes que cheguem à origem
- Introduz o problema de **invalidação**: conteúdo atualizado na origem continua servido do edge até expirar
- É a primeira camada de [[Estratégias de Cache]] de uma arquitetura web, antes de qualquer cache de aplicação

## Veja também

- [[Load Balancer]]
- [[Latency Numbers]]
- [[Distributed Cache]]
- [[Estratégias de Cache]]
- [[Microservices]]
