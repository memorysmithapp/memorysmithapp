---
title: "Comandos de CLI - Manutenção e Diagnóstico de Sistema"
aliases: [maintenance:enable, system:status, task:unlock, system:check_requirements]
tags: [cli, manutencao, sistema, diagnostico, seguranca, comandos, operacional]
type: process
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-g1-005 · Referência da linha de comando bin-console (cli.rst)|EV-2-g1-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Família de comandos `bin/console` para **manutenção**, **diagnóstico de sistema**, **segurança** e **desbloqueio de tarefas**. Ver [[Interface de Linha de Comando (bin-console)]].

## Modo de manutenção

| Comando (aliases) | Descrição | Opções |
|-------------------|-----------|--------|
| `glpi:maintenance:enable` (`maintenance:enable`) | Ativa o modo de manutenção | `--text`/`-t` (texto exibido durante a manutenção) |
| `glpi:maintenance:disable` (`maintenance:disable`) | Desativa o modo de manutenção | — |

## Diagnóstico de sistema

| Comando (aliases) | Descrição | Opções |
|-------------------|-----------|--------|
| `glpi:system:check_requirements` (`system:check_requirements`) | Verifica os requisitos do sistema (ver [[Tecnologias e requisitos de plataforma]]) | — |
| `glpi:system:list_services` (`system:list_services`) | Lista os serviços do sistema | — |
| `glpi:system:status` (`system:status`) | Verifica o status do sistema (ver [[Monitoramento de Status e Health Check]]) | `--format`/`-f` (plain\|json, default plain), `--private`/`-p`, `--service`/`-s` (default all) |

## Segurança

| Comando | Descrição |
|---------|-----------|
| `glpi:security:change_key` | Altera a chave de armazenamento de senhas e atualiza os valores no banco (alias `None`) |

## Desbloqueio de tarefas automáticas

| Comando (aliases) | Descrição | Opções |
|-------------------|-----------|--------|
| `glpi:task:unlock` (`task:unlock`) | Desbloqueia [[Ações Automáticas (CronTask)]] travadas | `--all`/`-a`, `--cycle`/`-c` (nº de ciclos = frequência × ciclo), `--delay`/`-d` (segundos até considerar travada; default 1800), `--task`/`-t` (array; ex. `MailCollector::mailgate`) |

> [!tip] Tarefas travadas
> Uma ação automática pode ficar "presa" se um processo anterior não terminou. `glpi:task:unlock` libera essas tarefas; o critério de "travada" é dado por `--delay` (segundos) ou `--cycle` (múltiplos da frequência da tarefa). O alvo `MailCollector::mailgate` liga-se ao [[Coletor de E-mail (MailCollector)]].

Ligações: [[Arquitetura de execução (request lifecycle)]] · [[Interface de Linha de Comando (bin-console)]]
