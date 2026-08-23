---
title: Memcached
aliases:
  - Memcache
tags:
  - caching
  - performance
  - distributed-cache
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Sistema de cache distribuído em memória, de chave-valor, usado para tirar carga de leitura de bancos de dados e acelerar operações repetitivas.

## Conceito

É um [[Distributed Cache]] deliberadamente simples: guarda pares chave-valor em RAM, sem persistência. **Reiniciou, perdeu tudo** — e isso é aceitável por desenho, porque o que ele guarda é reconstruível.

Essa restrição é o que o torna barato de operar: um nó Memcached exige muito menos CPU que um nó de banco.

## Características

Estatísticas operacionais relevantes:

| Métrica | O que indica |
|---|---|
| `accepting_conns` | Conexões aceitas; sobe a cada serviço novo configurado |
| `bytes` | Bytes em uso pelos itens em tempo real |
| `bytes_read` / `bytes_written` | Tráfego de entrada e saída |
| `cmd_get` / `cmd_set` | Comandos recebidos e processados |
| `get_hits` / `get_misses` | Acertos e erros. **Hit rate = `get_hits` ÷ `cmd_get`** |

> [!important] Cache não é storage
> A perda total no restart é a característica que define quando usar: dado reconstruível (token, sessão, resultado de query) sim; dado autoritativo, nunca.

## Exemplo — OpenStack

O gargalo que ele resolve é concreto: cada criação de instância dispara requisições a Nova, Glance, Cinder e Neutron, e **a cada uma delas o [[Keystone]] valida o token no banco**. Em volume, isso vira CPU consumida e latência acumulada em lookups de token expirado.

Com o cache habilitado, o Keystone guarda os tokens no Memcached em vez do banco. Em deployments grandes, o cache ganha cluster dedicado, servido pelo load balancer em modo TCP.

## Veja também

- [[Distributed Cache]]
- [[Estratégias de Cache]]
- [[Keystone]]
- [[Gerenciamento de Sessão]]
