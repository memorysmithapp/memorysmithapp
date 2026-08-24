---
title: EV-1-037 · CronTask — ações automáticas (interno/externo)
aliases: [EV-1-037]
tags: [evidence, dominio/operacao, cron]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-001 · src/CronTask.php L59, 79–81, 831, 966 · GLPI_CRON_DIR (locks)"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-037 · CronTask — ações automáticas (interno/externo)

> [!quote] `src/CronTask.php`
> ```php
> class CronTask extends CommonDBTM {
>     const MODE_INTERNAL = 1;  // disparado por acessos web (GLPI cron)
>     const MODE_EXTERNAL = 2;  // cron do sistema / CLI (recomendado em produção)
>     public static function launch($mode, $max = 1, $name = '') { ... }
>     public static function register($itemtype, $name, $frequency, $options = []) { ... }
> }
> // locks em GLPI_CRON_DIR (all.lock / <name>.lock) evitam concorrência
> ```

As **ações automáticas** do GLPI são `CronTask`s registradas por cada itemtype
(`CronTask::register`) com uma **frequência**. Rodam em **modo interno** (piggyback em
requisições web) ou **externo** (cron do SO / `front/cron.php`, recomendado). Exemplos:
envio da **fila de notificações**, **escalonamento de SLA**, **alertas** de contrato/garantia/
estoque, **sincronização LDAP**, limpeza de inventário, fechamento automático de chamados.

## Sustenta
- [[Ações Automáticas (CronTask)]]
- [[INV-1-004 · Ações de escalonamento de SLA]]
- [[INV-1-008 · Alertas e crons de vencimento]]
