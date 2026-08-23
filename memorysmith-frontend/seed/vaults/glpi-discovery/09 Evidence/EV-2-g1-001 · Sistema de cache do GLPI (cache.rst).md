---
title: EV-2-g1-001 · Sistema de cache do GLPI (cache.rst)
aliases: [EV-2-g1-001]
tags: [evidence, cache, opcache, performance, operacional]
type: evidence
status: confirmed
source: "SRC-002 · advanced/cache.rst · Using the cache / OPCache"
author: CAD Discovery (doc)
created: 2026-07-12
---

## Trecho / Paráfrase

> [!quote] advanced/cache.rst — "Using the cache"
> A informação sobre uso de cache está em *Configuration / General / System*. Recurso adicionado na versão 9.2 (alterado em 9.2.1). Se um dos sistemas de cache **APCu** ou **WinCache** estiver presente no servidor, o GLPI o utiliza automaticamente. O sistema é baseado no **Symfony Cache**. O cache melhora o desempenho de operações pesadas, como carregar traduções ou calcular árvores de entidades.
>
> Há **dois caches distintos**: o **cache de banco de dados** (`cache_db`) e o **cache de traduções** (`cache_trans`). Essa distinção evita armazenar o cache de traduções em rede (o que geraria requisições demais); ao contrário, o cache de banco deve ficar em rede no caso de múltiplos front-ends.
>
> Para refinar as configurações ou usar outro sistema de cache, adiciona-se à tabela `glpi_configs` uma chave `cache_db` e/ou `cache_trans` no contexto `core`, com valor JSON como `{"adapter":"apcu"}` ou `{"adapter":"redis","options":{"server":{"host":"127.0.0.1"}}}`. Para **desabilitar** um cache, cria-se a chave com valor em branco. Referência: método `Config::getCache()` e documentação do Symfony Cache.

> [!warning] Namespace de cache
> Se várias instâncias do GLPI forem instaladas no mesmo servidor, o **namespace do cache deve ser único por instância** (não era o caso antes da 9.2.4). Namespaces próprios devem ser únicos em cada instância.

> [!quote] advanced/cache.rst — "OPCache"
> O **OPCache** armazena arquivos PHP pré-compilados em memória, melhorando o desempenho; basta instalá-lo e configurá-lo na instância PHP (a configuração padrão costuma bastar). Em instâncias muito usadas, pode ser útil **não incluir os arquivos de fonte para PDFs** neste cache (ocupam muito espaço com ganho mínimo). Para excluí-los, informa-se o caminho completo em um arquivo de blacklist do opcache, cujo caminho é definido pela diretiva `opcache.blacklist_filename` (ex.: `/etc/php.d/opcache-glpi.blacklist` no Fedora). O caminho a excluir aponta para `.../vendor/tecnickcom/tcpdf/fonts/`.

## Sustenta

- [[Sistema de Cache do GLPI (operacional)]]
- [[OPCache e otimização de PHP]]
- [[Override de Locales e Traduções (gettext)]]
- [[Comandos de CLI - Cache e Configuração]]
