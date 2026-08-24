---
title: EV-2-g1-005 · Referência da linha de comando bin-console (cli.rst)
aliases: [EV-2-g1-005]
tags: [evidence, cli, bin-console, comandos, operacional]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · cli.rst · GLPI command-line interface"
author: CAD Discovery (doc)
created: 2026-07-12
---

## Trecho / Paráfrase

> [!quote] cli.rst — "GLPI command-line interface"
> O GLPI inclui uma ferramenta de CLI para gerenciar a instância, fornecida pelo script **`bin/console`**, executado a partir da raiz do diretório do GLPI. Cada comando pode ter zero ou mais **argumentos** (informações posicionais) ou **opções** (não posicionais, prefixadas por um ou dois hífens). A página é gerada automaticamente pelo comando `dev:docs:generate:cli` do plugin `dev`.

> [!note] Comandos documentados (nome · aliases · descrição · opções principais)
> **Ativos/Software**
> - `glpi:assets:cleansoftware` (`assets:cleansoftware`) — Remove versões de software sem instalação e software sem versão. Opção `--max`/`-m` (obrigatória, default 500): máx. de itens por execução.
> - `glpi:assets:purgesoftware` (`assets:purgesoftware`) — Purga software sem versão que foi excluído. Opção `--max`/`-m` (default 500). Há ação equivalente na WebUI (captura `images/assets_purge_software.png`).
>
> **Build/UI**
> - `glpi:build:compile_scss` (`build:compile_scss`) — Compila arquivo SCSS. Opções `--file`/`-f` (compila todos por padrão; array), `--dry-run` (simula sem salvar CSS).
>
> **Cache**
> - `glpi:cache:clear` (aliases: `cache:clear, glpi:system:clear_cache, system:clear_cache`) — Limpa o cache do GLPI. Opção `--context`/`-c` (array; todos os contextos por padrão; ex.: `core` ou `plugin:plugin_name`).
> - `glpi:cache:configure` (`cache:configure`) — Define configuração de cache. Opções: `--context` (default `core`), `--dsn` (array; DSN do sistema de cache), `--use-default` (volta ao cache de filesystem padrão), `--skip-connection-checks`. Sistemas válidos: Memcached, Redis (TCP `redis://`), Redis (TLS `rediss://`). Ex.: `--dsn=redis://redis.glpi-project.org:6379/glpi`.
> - `glpi:cache:debug` (`cache:debug`) — Depura o cache. Opções `--key`/`-k` (array), `--context`/`-c` (default `core`).
> - `glpi:cache:set_namespace_prefix` (`cache:set_namespace_prefix`) — Define prefixo de namespace do cache. Argumento posicional `prefix` (obrigatório).
>
> **Configuração**
> - `glpi:config:set` (`config:set`) — Define valor de configuração. Argumentos `key`, `value` (omitir `value` para ser solicitado). Opção `--context`/`-c` (default `core`).
>
> **Banco de dados**
> - `glpi:database:check_schema_integrity` (`db:check_schema_integrity, glpi:database:check, db:check`) — Verifica diferenças de schema entre o banco atual e o arquivo de instalação. Opções: `--strict`, `--check-all-migrations`, `--check-innodb-migration`, `--check-timestamps-migration`, `--check-utf8mb4-migration`, `--check-dynamic-row-format-migration`, `--check-unsigned-keys-migration`.
> - `glpi:database:configure` (`db:configure`) — Define configuração do banco. Opções `--db-host`/`-H` (default localhost), `--db-name`/`-d` (obrig.), `--db-password`/`-p`, `--db-port`/`-P`, `--db-user`/`-u` (obrig.), `--reconfigure`/`-r`, `--strict-configuration`.
> - `glpi:database:enable_timezones` (`db:enable_timezones`) — Habilita uso de fusos horários.
> - `glpi:database:install` (`db:install`) — Instala o schema do banco. Opções de conexão (idem acima) mais `--default-language`/`-L` (default en_GB), `--force`/`-f` (sobrescreve banco existente), `--enable-telemetry`/`--no-telemetry`.
> - `glpi:database:update` (`db:update`) — Atualiza o schema para nova versão. Opções `--allow-unstable`/`-u`, `--force`/`-f`, `--enable-telemetry`/`--no-telemetry`.
>
> **LDAP**
> - `glpi:ldap:synchronize_users` (`ldap:sync`) — Sincroniza usuários com o servidor LDAP. Opções: `--only-create-new`/`-c`, `--only-update-existing`/`-u`, `--ldap-server-id`/`-s` (array), `--ldap-filter`/`-f`, `--begin-date`, `--end-date`, `--deleted-user-strategy`/`-d` (0 Preserve, 1 Trashbin, 2 Withdraw dynamic auth/groups, 3 Disable, 4 Disable+Withdraw), `--restored-user-strategy`/`-r` (0 Nothing, 1 Restore, 3 Enable).
>
> **Manutenção**
> - `glpi:maintenance:enable` (`maintenance:enable`) — Ativa modo de manutenção. Opção `--text`/`-t` (texto exibido durante a manutenção).
> - `glpi:maintenance:disable` (`maintenance:disable`) — Desativa modo de manutenção.
>
> **Marketplace/Plugins**
> - `glpi:marketplace:download` (`marketplace:download`) — Baixa plugin do marketplace. Argumento `plugins` (chave, array, obrig.). Opção `--force`/`-f`.
> - `glpi:marketplace:info` (`marketplace:info`) — Info sobre um plugin. Argumento `plugin`.
> - `glpi:marketplace:search` (`marketplace:search`) — Busca no marketplace. Argumento `term`.
> - `glpi:plugin:activate` (`plugin:activate`) — Ativa plugin(s). Argumento `directory`. Opção `--all`/`-a`.
> - `glpi:plugin:deactivate` (`plugin:deactivate`) — Desativa plugin(s). Argumento `directory`. Opção `--all`/`-a`.
> - `glpi:plugin:install` (`plugin:install`) — Executa script de instalação de plugin(s). Argumento `directory`. Opções `--all`/`-a`, `--param`/`-p` (array; ex. `-p foo=bar`), `--username`/`-u` (obrig.), `--force`/`-f`.
>
> **Migração** (aliases: None — sem alias)
> - `glpi:migration:appliances_plugin_to_core` — Migra dados do plugin Appliances para o core. Opção `--skip-errors`/`-s`.
> - `glpi:migration:build_missing_timestamps` — Define `date_creation`/`date_mod` ausentes via logs.
> - `glpi:migration:databases_plugin_to_core` — Migra plugin Databases para o core. Opção `--skip-errors`/`-s`.
> - `glpi:migration:domains_plugin_to_core` — Migra plugin Domains para o core. Opção `--skip-errors`/`-s`.
> - `glpi:migration:dynamic_row_format` — Converte tabelas para formato de linha "Dynamic" (necessário para utf8mb4).
> - `glpi:migration:myisam_to_innodb` — Migra tabelas MyISAM para InnoDB.
> - `glpi:migration:racks_plugin_to_core` — Migra plugin Racks para o core. Opções `--ignore-other-elements`/`-i`, `--skip-errors`/`-s`, `--truncate`/`-t`, `--update-plugin`/`-u`, `--without-plugin`/`-w`.
> - `glpi:migration:timestamps` — Converte campos "datetime" para "timestamp" (fusos horários).
> - `glpi:migration:unsigned_keys` — Migra chaves primárias/estrangeiras para inteiros sem sinal.
> - `glpi:migration:utf8mb4` — Converte charset do banco de "utf8" para "utf8mb4".
>
> **Regras/Dicionários**
> - `glpi:rules:process_software_category_rules` (`rules:process_software_category_rules`) — Processa regras de categoria de software. Opção `--all`/`-a`.
> - `glpi:rules:replay_dictionnary_rules` (`rules:replay_dictionnary_rules`) — Reprocessa regras de dicionário em itens existentes. Opções `--dictionnary`/`-d` (obrig.; valores incluem ComputerModel, Manufacturer, OperatingSystem, Software, etc.), `--manufacturer-id`/`-m` (só Software).
>
> **Segurança**
> - `glpi:security:change_key` — Altera a chave de armazenamento de senhas e atualiza valores no banco.
>
> **Sistema/Status**
> - `glpi:system:check_requirements` (`system:check_requirements`) — Verifica requisitos do sistema.
> - `glpi:system:list_services` (`system:list_services`) — Lista os serviços do sistema.
> - `glpi:system:status` (`system:status`) — Verifica o status do sistema. Opções `--format`/`-f` (plain|json, default plain), `--private`/`-p`, `--service`/`-s` (default all).
>
> **Tarefas/Ferramentas**
> - `glpi:task:unlock` (`task:unlock`) — Desbloqueia ações automáticas. Opções `--all`/`-a`, `--cycle`/`-c`, `--delay`/`-d` (default 1800s), `--task`/`-t` (array; ex. `MailCollector::mailgate`).
> - `glpi:tools:check_database_keys` (`tools:check_database_keys`) — Verifica chaves ausentes/errôneas no banco. Opções `--detect-misnamed-keys`, `--detect-useless-keys`.
> - `glpi:tools:check_database_schema_consistency` (`tools:check_database_schema_consistency`) — Verifica consistência do schema do banco.
> - `glpi:tools:delete_orphan_logs` (`tools:delete_orphan_logs`) — Exclui logs órfãos. Opção `--dry-run`.

## Sustenta

- [[Interface de Linha de Comando (bin-console)]]
- [[Comandos de CLI - Cache e Configuração]]
- [[Comandos de CLI - Banco de Dados]]
- [[Comandos de CLI - Migração de Dados]]
- [[Comandos de CLI - Plugins e Marketplace]]
- [[Comandos de CLI - Manutenção e Diagnóstico de Sistema]]
- [[Comandos de CLI - Regras, Ativos e Ferramentas]]
