---
title: OSProfiler
aliases:
  - OpenStack Profiler
tags:
  - openstack
  - profiling
  - tracing
  - performance
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Biblioteca de tracing do OpenStack: acompanha uma requisição enquanto ela atravessa os serviços e monta a linha do tempo de onde o tempo foi gasto.

## Conceito

Monitoramento, log e debug respondem "o que quebrou". Nenhum deles responde "**onde** esta requisição específica gastou os oito segundos". Essa é a lacuna do OSProfiler.

Num sistema com dezenas de serviços conversando por API e fila, a única forma de responder é rastrear o caminho — o mesmo raciocínio de [[Distributed Tracing]] aplicado à infraestrutura.

## Características

- Captura tempo de resposta de **APIs, bancos, drivers e chamadas RPC**.
- Desde o release **Antelope**, cobre todos os serviços core.
- Traces podem ser persistidos em Redis, Elasticsearch, arquivo simples ou MongoDB.
- O relatório HTML expõe, por chamada: natureza do serviço, projeto correspondente e o detalhe em JSON.

Uso: `openstack --os-profile <SECRET> image list` gera um trace UUID por requisição.

## Comparação

| | [[Rally]] | OSProfiler |
|---|---|---|
| Responde | Quais são meus limites sob carga? | Onde esta requisição gasta o tempo? |
| Método | Carga sintética agregada | Trace de requisição individual |
| Quando usar | Antes de promover mudança | Depois de detectar anomalia |

## Veja também

- [[Distributed Tracing]]
- [[Profiling]]
- [[Rally]]
- [[Observability]]
