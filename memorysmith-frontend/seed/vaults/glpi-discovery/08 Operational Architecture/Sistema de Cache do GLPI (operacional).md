---
title: Sistema de Cache do GLPI (operacional)
aliases: [cache GLPI, cache_db, cache_trans, Symfony Cache]
tags: [cache, performance, operacional, symfony, redis, apcu]
type: infra
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-g1-001 · Sistema de cache do GLPI (cache.rst)|EV-2-g1-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

O GLPI mantém um subsistema de **cache** para acelerar operações relativamente pesadas — notadamente o **carregamento de traduções** e o **cálculo de árvores de entidades** (ver [[Modelo de Entidades (multi-tenancy)]] e [[Recursividade em entidades]]). O recurso foi introduzido na versão 9.2 e é baseado no **Symfony Cache**. A configuração é visível na interface em *Configuration / General / System*.

## Dois caches distintos

Existem duas caches separadas, cada uma com sua chave de configuração no contexto `core` da tabela `glpi_configs`:

| Cache | Chave | Recomendação de localização |
|-------|-------|-----------------------------|
| Cache de **banco de dados** | `cache_db` | Deve ficar **em rede** quando há múltiplos front-ends (compartilhado) |
| Cache de **traduções** | `cache_trans` | Deve ficar **local**, para não gerar tráfego de rede excessivo |

A separação existe justamente para evitar armazenar o cache de traduções em rede (o que produziria requisições demais, com impacto negativo).

## Detecção automática e configuração manual

> [!note] Detecção automática
> Se **APCu** ou **WinCache** estiverem presentes no servidor, o GLPI os utiliza automaticamente.

Para refinar a configuração ou usar outro sistema de cache, adiciona-se manualmente a chave `cache_db` e/ou `cache_trans` (contexto `core`) na tabela `glpi_configs`, com valor JSON. Exemplos:

- `{"adapter":"apcu"}`
- `{"adapter":"redis","options":{"server":{"host":"127.0.0.1"}}}`

Para **desabilitar** um dos caches, cria-se a chave com **valor em branco**. A implementação de referência é o método `Config::getCache()` (ponte com o código — ver [[Configuração e Instalação]]).

> [!warning] Namespace único por instância
> Ao instalar várias instâncias do GLPI no mesmo servidor, o **namespace do cache deve ser único por instância** (não era garantido antes da 9.2.4). Namespaces próprios também devem ser únicos em cada instância. O prefixo pode ser definido por CLI — ver [[Comandos de CLI - Cache e Configuração]] (`glpi:cache:set_namespace_prefix`).

## Operação

A limpeza do cache é uma tarefa operacional recorrente (por exemplo após [[Override de Locales e Traduções (gettext)]]), feita pela interface (modo Debug) ou pelo comando `glpi:cache:clear`. A configuração de backends modernos (Memcached/Redis) também pode ser feita por `glpi:cache:configure` — ver [[Comandos de CLI - Cache e Configuração]].

Ligações: [[Arquitetura de execução (request lifecycle)]] · [[OPCache e otimização de PHP]] · [[Configuração Avançada do GLPI (visão geral)]]

> [!question] Divergência entre mecanismos de configuração de cache
> A configuração manual via chaves `cache_db`/`cache_trans` (cache.rst) e o comando `glpi:cache:configure` parecem coexistir — ver [[INV-2-g1-001 · Configuração de cache via tabela vs comando glpi-cache-configure]].
