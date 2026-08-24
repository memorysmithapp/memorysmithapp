---
title: "Comandos de CLI - Cache e Configuração"
aliases: [cache:clear, cache:configure, config:set, cache:debug]
tags: [cli, cache, configuracao, comandos, operacional]
type: process
maturity: evergreen
reviewed: false
source: "[[EV-2-g1-005 · Referência da linha de comando bin-console (cli.rst)|EV-2-g1-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Família de comandos `bin/console` que administram o [[Sistema de Cache do GLPI (operacional)]] e valores de configuração. Ver [[Interface de Linha de Comando (bin-console)]].

## Cache

| Comando (aliases) | Descrição | Opções principais |
|-------------------|-----------|-------------------|
| `glpi:cache:clear` (`cache:clear`, `glpi:system:clear_cache`, `system:clear_cache`) | Limpa o cache do GLPI | `--context`/`-c` (array; todos por padrão; ex.: `core`, `plugin:nome`) |
| `glpi:cache:configure` (`cache:configure`) | Define a configuração do cache | `--context` (default `core`), `--dsn` (array), `--use-default`, `--skip-connection-checks` |
| `glpi:cache:debug` (`cache:debug`) | Depura o cache | `--key`/`-k` (array), `--context`/`-c` (default `core`) |
| `glpi:cache:set_namespace_prefix` (`cache:set_namespace_prefix`) | Define o prefixo de namespace do cache | argumento posicional `prefix` (obrigatório) |

> [!info] Backends de cache (glpi:cache:configure)
> Sistemas válidos: **Memcached**, **Redis (TCP)** e **Redis (TLS)**.
> - Memcached DSN: `memcached://[user:pass@][host[:port]][?weight=int]`
> - Redis (TCP) DSN: `redis://[pass@][host[:port]][/db-index]`
> - Redis (TLS) DSN: `rediss://[pass@][host[:port]][/db-index]`
>
> O **namespace** de cache permite separar ou compartilhar dados de múltiplas instâncias no mesmo sistema de cache. Exemplos:
> - `glpi:cache:configure --use-default`
> - `glpi:cache:configure --dsn=memcached://cache1.glpi-project.org --dsn=memcached://cache2.glpi-project.org`
> - `glpi:cache:configure --dsn=redis://redis.glpi-project.org:6379/glpi`

> [!tip] `glpi:cache:clear` é o comando citado no procedimento de [[Override de Locales e Traduções (gettext)]] para aplicar novas traduções (executar como o usuário do servidor web).

## Configuração

| Comando (aliases) | Descrição | Argumentos / Opções |
|-------------------|-----------|---------------------|
| `glpi:config:set` (`config:set`) | Define um valor de configuração | args `key`, `value` (omitir `value` para ser solicitado); opção `--context`/`-c` (default `core`) |

Ligações: [[Configuração e Instalação]] · [[Interface de Linha de Comando (bin-console)]]
