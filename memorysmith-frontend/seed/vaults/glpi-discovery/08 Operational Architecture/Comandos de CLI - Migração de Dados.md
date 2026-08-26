---
title: "Comandos de CLI - Migração de Dados"
aliases: [migration, plugin_to_core, utf8mb4, myisam_to_innodb]
tags: [cli, migracao, schema, plugins, comandos, operacional]
type: process
maturity: evergreen
reviewed: false
source: "[[EV-2-g1-005 · Referência da linha de comando bin-console (cli.rst)|EV-2-g1-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Família de comandos `bin/console` prefixados por `glpi:migration:` para **migrações pontuais de dados e de schema**. Todos têm alias `None` (sem alias curto). Complementam as verificações de [[Comandos de CLI - Banco de Dados]]. Ver [[Interface de Linha de Comando (bin-console)]].

## Migração de plugins para o núcleo (plugin-to-core)

Movem dados de plugins históricos que foram absorvidos pelo core do GLPI:

| Comando | Descrição | Opções |
|---------|-----------|--------|
| `glpi:migration:appliances_plugin_to_core` | Migra dados do plugin **Appliances** | `--skip-errors`/`-s` |
| `glpi:migration:databases_plugin_to_core` | Migra dados do plugin **Databases** | `--skip-errors`/`-s` |
| `glpi:migration:domains_plugin_to_core` | Migra dados do plugin **Domains** | `--skip-errors`/`-s` |
| `glpi:migration:racks_plugin_to_core` | Migra dados do plugin **Racks** (ver [[DCIM (Datacenter → Rack)]]) | `--ignore-other-elements`/`-i`, `--skip-errors`/`-s`, `--truncate`/`-t`, `--update-plugin`/`-u`, `--without-plugin`/`-w` |

## Migração de schema / formato de armazenamento

| Comando | Descrição |
|---------|-----------|
| `glpi:migration:myisam_to_innodb` | Migra tabelas **MyISAM → InnoDB** |
| `glpi:migration:timestamps` | Converte campos `datetime` → `timestamp` (habilita fusos horários) |
| `glpi:migration:dynamic_row_format` | Converte tabelas para formato de linha **DYNAMIC** (pré-requisito para utf8mb4) |
| `glpi:migration:utf8mb4` | Converte o charset do banco de `utf8` → `utf8mb4` |
| `glpi:migration:unsigned_keys` | Migra chaves primárias/estrangeiras para inteiros **sem sinal** |
| `glpi:migration:build_missing_timestamps` | Preenche `date_creation`/`date_mod` ausentes usando entradas de log |

> [!warning] Ordem e pré-requisitos
> Há dependência entre migrações: o suporte a **utf8mb4** requer o formato de linha **DYNAMIC**; o uso de fusos requer campos **timestamp**. O comando `glpi:database:check_schema_integrity` (ver [[Comandos de CLI - Banco de Dados]]) verifica os tokens de cada uma dessas migrações.

Ligações: [[Plugins e Marketplace]] · [[Interface de Linha de Comando (bin-console)]]
