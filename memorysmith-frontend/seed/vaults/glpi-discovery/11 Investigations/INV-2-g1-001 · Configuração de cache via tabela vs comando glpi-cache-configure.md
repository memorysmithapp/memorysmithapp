---
title: INV-2-g1-001 · Configuração de cache via tabela vs comando glpi-cache-configure
aliases: [INV-2-g1-001]
tags: [investigation, consumidor/cad, cache, operacional, divergencia-doc]
type: investigation
status: open
maturity: seed
reviewed: false
source: "SRC-002 · advanced/cache.rst ; cli.rst · glpi:cache:configure"
author: CAD Discovery (doc)
created: 2026-07-12
---

## Dúvida

A documentação apresenta **dois mecanismos aparentemente distintos** para configurar o cache do GLPI, sem esclarecer a relação/precedência entre eles:

1. **`advanced/cache.rst`** (recurso 9.2): configuração **manual** inserindo chaves `cache_db`/`cache_trans` (contexto `core`) na tabela `glpi_configs`, com valor JSON tipo `{"adapter":"apcu"}` ou `{"adapter":"redis",...}`.
2. **`cli.rst`** — comando **`glpi:cache:configure`**: usa DSN (`--dsn`) com sistemas Memcached / Redis (TCP) / Redis (TLS), além de `--use-default` e `--context`.

## O que investigar

- O `glpi:cache:configure` é a evolução/substituto do método manual da tabela, ou os dois convivem gravando na mesma estrutura?
- O método da tabela cita **APCu** como adapter, mas os sistemas "válidos" listados no `glpi:cache:configure` são apenas Memcached e Redis — o APCu ainda é suportado via configuração explícita?
- Precedência quando ambos estão definidos.

## Disparador

Divergência interna à própria documentação (`cache.rst` × `cli.rst`), notada pelo subagente g1 (sessão 2). Ver [[Sistema de Cache do GLPI (operacional)]] e [[Comandos de CLI - Cache e Configuração]]. Resolução idealmente cruzando com o código do método `Config::getCache()`.
