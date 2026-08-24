---
title: Tecnologias e requisitos de plataforma
aliases: [Stack, Requisitos, Tecnologias]
tags: [overview, tecnologia, dominio/foundation]
type: overview
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-002 · Constantes globais e bitmask de direitos|EV-1-002]]"
  - "[[EV-1-004 · Kernel Symfony MicroKernel envolve o legado|EV-1-004]]"
author: CAD Discovery
created: 2026-07-10
---

# Tecnologias e requisitos de plataforma

Stack e pré-requisitos do GLPI 11.0.7 (README `SRC-001` + [[EV-1-002 · Constantes globais e bitmask de direitos|EV-1-002]]/[[EV-1-004 · Kernel Symfony MicroKernel envolve o legado|EV-1-004]]).

## Runtime
- **PHP** ≥ 8.2 (`GLPI_MIN_PHP='8.2'`, `GLPI_MAX_PHP='8.5'`).
- **Banco de dados**: MariaDB ≥ 10.6 ou MySQL ≥ 8.0.
- **Servidor web**: Apache, Nginx, IIS.
- Extensões PHP obrigatórias: dom, fileinfo, filter, libxml, simplexml, xmlreader/writer,
  bcmath, curl, gd, intl, mbstring, mysqli, openssl, zlib.

## Frameworks e bibliotecas
- **Symfony** (HttpKernel, FrameworkBundle, Twig, WebProfiler) — ver [[Kernel e Bootstrap]].
- **Twig** — templates de view.
- Front-end: Webpack, SCSS, Vue.js (há `.vue.webpack.config.js`) e JS legado.
- Namespaces: `Glpi\` (`NS_GLPI`) para o core moderno; `GlpiPlugin\` (`NS_PLUG`) para plugins.

## Persistência
- Camada de acesso a dados própria: `DBmysql` / `DBmysqlIterator` e o builder `Glpi\DBAL\*`.
- Padrão de domínio: **Active Record** ([[CommonDBTM (Active Record)]]).

> [!note]
> Detalhes de operação (cache, cron, deploy) serão aprofundados no Módulo 6 —
> Operational Architecture.
