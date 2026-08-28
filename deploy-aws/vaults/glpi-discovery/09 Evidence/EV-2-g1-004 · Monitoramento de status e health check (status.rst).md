---
title: EV-2-g1-004 · Monitoramento de status e health check (status.rst)
aliases: [EV-2-g1-004]
tags: [evidence, status, health-check, monitoramento, servicos, operacional]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · advanced/status.rst · GLPI Status Monitoring"
author: CAD Discovery (doc)
created: 2026-07-12
---

## Trecho / Paráfrase

> [!quote] advanced/status.rst — "GLPI Status Monitoring"
> O GLPI possui um endpoint útil para monitorar sua saúde em **`/status.php`** e o comando de CLI **`glpi:system:status`**. O endpoint `/status.php` **não exige login** e, portanto, mostra apenas informações básicas de status. Informações sensíveis, como a **versão** do GLPI e os nomes/versões de plugins (que poderiam ser usados para identificar vulnerabilidades) **não são exibidas**. Tanto o script PHP quanto o comando de CLI apresentam a informação em **JSON**. A diferença é que, como o comando de CLI não é acessível pela web, pode-se opcionalmente recuperar também informações privadas.

> [!quote] advanced/status.rst — "Services"
> O status do GLPI é separado em múltiplos **"serviços"**, listáveis com `glpi:system:list_services`. Lista não exaustiva de serviços disponíveis:
> - `db` — Banco de dados (principal e réplicas)
> - `cas` — Central Authentication Server
> - `ldap` — LDAP/Active Directory
> - `imap` — Servidor(es) de e-mail
> - `mail_collectors` — Coletores de e-mail
> - `crontasks` — Ações automáticas
> - `filesystem` — Acesso ao sistema de arquivos
> - `plugins` — Status dos plugins

> [!quote] advanced/status.rst — "Status Endpoint" / "CLI Command"
> No endpoint, pode-se filtrar a saída para um serviço específico com o parâmetro de consulta `service`. No comando de CLI `glpi:system:status`, por padrão só são exibidas informações públicas; a opção `-p`/`--private` mostra todas as informações de status, e `-s`/`--service` filtra para um serviço específico.

## Sustenta

- [[Monitoramento de Status e Health Check]]
- [[Comandos de CLI - Manutenção e Diagnóstico de Sistema]]
