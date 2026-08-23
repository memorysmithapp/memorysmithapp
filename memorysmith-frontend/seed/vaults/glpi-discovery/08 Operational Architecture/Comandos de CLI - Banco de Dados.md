---
title: "Comandos de CLI - Banco de Dados"
aliases: [db:install, db:update, db:configure, db:check_schema_integrity]
tags: [cli, banco-de-dados, schema, instalacao, comandos, operacional]
type: process
status: confirmed
source: "[[EV-2-g1-005 · Referência da linha de comando bin-console (cli.rst)|EV-2-g1-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Família de comandos `bin/console` que instalam, configuram, atualizam e verificam o **banco de dados** do GLPI. Estão no núcleo do procedimento de [[Configuração e Instalação]]. Ver [[Interface de Linha de Comando (bin-console)]].

| Comando (aliases) | Descrição | Opções principais |
|-------------------|-----------|-------------------|
| `glpi:database:configure` (`db:configure`) | Define a configuração de conexão do banco | `--db-host`/`-H` (default localhost), `--db-name`/`-d` (obrig.), `--db-password`/`-p`, `--db-port`/`-P`, `--db-user`/`-u` (obrig.), `--reconfigure`/`-r`, `--strict-configuration` |
| `glpi:database:install` (`db:install`) | Instala o schema do banco | opções de conexão + `--default-language`/`-L` (default en_GB), `--force`/`-f`, `--enable-telemetry`/`--no-telemetry` |
| `glpi:database:update` (`db:update`) | Atualiza o schema para nova versão | `--allow-unstable`/`-u`, `--force`/`-f`, `--enable-telemetry`/`--no-telemetry` |
| `glpi:database:enable_timezones` (`db:enable_timezones`) | Habilita o uso de fusos horários | — |
| `glpi:database:check_schema_integrity` (`db:check_schema_integrity`, `glpi:database:check`, `db:check`) | Verifica diferenças de schema entre o banco atual e o arquivo de instalação | `--strict`, `--check-all-migrations`, `--check-innodb-migration`, `--check-timestamps-migration`, `--check-utf8mb4-migration`, `--check-dynamic-row-format-migration`, `--check-unsigned-keys-migration` |

> [!note] Telemetria
> Na instalação/atualização, as opções `--enable-telemetry`/`--no-telemetry` controlam o envio de estatísticas de uso ao serviço Telemetry (`telemetry.glpi-project.org`).

> [!info] Fusos horários e integridade
> `glpi:database:enable_timezones` prepara o banco para fusos; a verificação de integridade (`check_schema_integrity`) cobre justamente as migrações de MyISAM→InnoDB, datetime→timestamp, utf8→utf8mb4, formato de linha DYNAMIC e chaves sem sinal — todas com comandos dedicados em [[Comandos de CLI - Migração de Dados]].

Ligações: [[CommonDBTM (Active Record)]] · [[Dicionário de dados (dictionary)]] · [[Interface de Linha de Comando (bin-console)]]
