---
title: Sistemas de Cache e Performance
aliases: [Performances tab, Cache, Caches do GLPI]
tags: [configuracao-geral, performance, cache, operacao]
type: capability
maturity: evergreen
reviewed: false
source: "[[EV-2-f1-013 · Performances e sistemas de cache|EV-2-f1-013]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Aba **Performances** (Setup > General): exibe informações sobre os sistemas de cache usados pelo GLPI e permite **limpar** os caches.

## Caches
- **PHP opcode cache**: melhora a performance do engine PHP ao interpretar os arquivos PHP.
- **User data cache**: cache de propósito geral usado pelo GLPI.
- **Translation cache**: cache de traduções, evita reler os arquivos de locale.

Os caches de **user data** e **translations** podem ser trocados/configurados pelo comando CLI `cache:configure`.

> [!note]
> Relaciona-se à [[Arquitetura de execução (request lifecycle)]] e a [[Configuração e Instalação]].
