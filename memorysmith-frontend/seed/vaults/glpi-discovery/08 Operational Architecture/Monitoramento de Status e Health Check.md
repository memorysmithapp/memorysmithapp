---
title: Monitoramento de Status e Health Check
aliases: [status.php, health check, glpi:system:status, monitoramento]
tags: [status, health-check, monitoramento, servicos, observabilidade, operacional]
type: infra
status: confirmed
source: "[[EV-2-g1-004 · Monitoramento de status e health check (status.rst)|EV-2-g1-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

O GLPI expõe um **endpoint de health check** para monitoramento externo (Nagios, Zabbix, load balancers, etc.), em duas formas complementares:

| Forma | Acesso | Autenticação | Informação sensível |
|-------|--------|--------------|---------------------|
| Endpoint web `/status.php` | HTTP público | **Não exige login** | **Nunca** exibida (versão do GLPI, nomes/versões de plugins ficam ocultos) |
| Comando de CLI `glpi:system:status` | Terminal do servidor | Acesso ao SO | Opcionalmente exibida com `-p`/`--private` |

Ambos apresentam a informação em **JSON**. A distinção fundamental é de **segurança**: como o endpoint `/status.php` é acessível sem login, ele omite deliberadamente dados que poderiam ajudar a identificar vulnerabilidades (versão, plugins). Já a CLI, por não ser acessível pela web, pode revelar essas informações privadas sob demanda.

> [!note] Por que ocultar a versão
> Expor a versão do GLPI e a lista de plugins/versões facilitaria a um atacante correlacionar vulnerabilidades conhecidas. Por isso o endpoint público sempre entrega apenas o status **básico**.

## Serviços monitorados

O status é decomposto em múltiplos **"serviços"**, listáveis com `glpi:system:list_services`. Lista (não exaustiva):

| Serviço | O que verifica | Nota relacionada |
|---------|----------------|------------------|
| `db` | Banco de dados (principal e réplicas) | [[CommonDBTM (Active Record)]] |
| `cas` | Central Authentication Server | [[Autenticação e Single Sign-On (processo)]] |
| `ldap` | LDAP/Active Directory | [[Fluxo de login e provisionamento]] |
| `imap` | Servidor(es) de e-mail | [[Coletor de E-mail (MailCollector)]] |
| `mail_collectors` | Coletores de e-mail | [[Coletor de E-mail (MailCollector)]] |
| `crontasks` | Ações automáticas | [[Ações Automáticas (CronTask)]] |
| `filesystem` | Acesso ao sistema de arquivos | [[Configuração e Instalação]] |
| `plugins` | Status dos plugins | [[Sistema de Plugins (Hooks)]] |

## Filtro por serviço

- **Endpoint**: parâmetro de consulta `service` (ex.: `/status.php?service=db`).
- **CLI**: opção `-s`/`--service` (default `all`); formato de saída via `-f`/`--format` (plain|json). Ver [[Comandos de CLI - Manutenção e Diagnóstico de Sistema]].

> [!tip] Uso operacional
> O `/status.php` é o insumo típico de **monitoramento contínuo** e de *health checks* de balanceadores de carga (que precisam saber se aquele front-end está saudável), enquanto o `glpi:system:status -p` serve a **diagnósticos administrativos** mais detalhados no próprio servidor.

Ligações: [[Configuração Avançada do GLPI (visão geral)]] · [[Arquitetura de execução (request lifecycle)]] · [[API REST e GraphQL]]

> [!question] Semântica dos estados de saúde
> A documentação não detalha os estados/limiares (ex.: OK/warning/erro) retornados por serviço — ver [[INV-2-g1-002 · Estados e limiares de saúde do endpoint de status não documentados]].
