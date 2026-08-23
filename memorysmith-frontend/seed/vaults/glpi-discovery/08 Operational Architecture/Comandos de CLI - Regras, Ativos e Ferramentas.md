---
title: "Comandos de CLI - Regras, Ativos e Ferramentas"
aliases: [rules:replay_dictionnary_rules, ldap:sync, tools:delete_orphan_logs, build:compile_scss]
tags: [cli, regras, dicionarios, ativos, ldap, ferramentas, comandos, operacional]
type: process
status: confirmed
source: "[[EV-2-g1-005 · Referência da linha de comando bin-console (cli.rst)|EV-2-g1-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Família heterogênea de comandos `bin/console` para **regras/dicionários**, **limpeza de ativos**, **sincronização LDAP**, **compilação de recursos** e **ferramentas de manutenção do banco**. Ver [[Interface de Linha de Comando (bin-console)]].

## Regras e dicionários

| Comando (aliases) | Descrição | Opções |
|-------------------|-----------|--------|
| `glpi:rules:process_software_category_rules` (`rules:process_software_category_rules`) | Processa as regras de categoria de software | `--all`/`-a` (inclui software que já tem categoria) |
| `glpi:rules:replay_dictionnary_rules` (`rules:replay_dictionnary_rules`) | Reprocessa regras de dicionário sobre itens existentes | `--dictionnary`/`-d` (obrig.; ex.: ComputerModel, Manufacturer, OperatingSystem, Software…), `--manufacturer-id`/`-m` (só Software) |

Ligações: [[Motor de Regras de Negócio (capacidade)]] · [[Tipos de Regra]] · [[Dicionário de dados (dictionary)]].

## Ativos / Software

| Comando (aliases) | Descrição | Opções |
|-------------------|-----------|--------|
| `glpi:assets:cleansoftware` (`assets:cleansoftware`) | Remove versões de software sem instalação e software sem versão | `--max`/`-m` (obrig.; default 500) |
| `glpi:assets:purgesoftware` (`assets:purgesoftware`) | Purga software sem versão que foi excluído (ação equivalente existe na WebUI) | `--max`/`-m` (default 500) |

Ligações: [[Software, Versões e Licenças]] · [[Gestão de Software e Licenças (processo)]].

## Sincronização LDAP

| Comando (aliases) | Descrição | Opções |
|-------------------|-----------|--------|
| `glpi:ldap:synchronize_users` (`ldap:sync`) | Sincroniza usuários com o servidor LDAP | `--only-create-new`/`-c`, `--only-update-existing`/`-u`, `--ldap-server-id`/`-s` (array), `--ldap-filter`/`-f`, `--begin-date`, `--end-date`, `--deleted-user-strategy`/`-d`, `--restored-user-strategy`/`-r` |

> [!info] Estratégias de usuários (LDAP)
> **Deletados** (`-d`): 0 Preservar · 1 Mover para lixeira · 2 Retirar autorizações/grupos dinâmicos · 3 Desabilitar · 4 Desabilitar + retirar.
> **Restaurados** (`-r`): 0 Nada · 1 Restaurar (sair da lixeira) · 3 Habilitar.

Ligações: [[Fluxo de login e provisionamento]] · [[Gestão de Usuários e Acesso (processo)]] · [[Lixeira e purga (trash bin)]].

## Build e ferramentas de manutenção

| Comando (aliases) | Descrição | Opções |
|-------------------|-----------|--------|
| `glpi:build:compile_scss` (`build:compile_scss`) | Compila arquivos SCSS (usado por [[Paletas Customizadas (temas SCSS)]]) | `--file`/`-f` (array; todos por padrão), `--dry-run` |
| `glpi:tools:check_database_keys` (`tools:check_database_keys`) | Verifica chaves ausentes/errôneas no banco | `--detect-misnamed-keys`, `--detect-useless-keys` |
| `glpi:tools:check_database_schema_consistency` (`tools:check_database_schema_consistency`) | Verifica a consistência do schema do banco | — |
| `glpi:tools:delete_orphan_logs` (`tools:delete_orphan_logs`) | Exclui logs órfãos | `--dry-run` |

Ligações: [[Comandos de CLI - Banco de Dados]] · [[Interface de Linha de Comando (bin-console)]]
