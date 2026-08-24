---
title: Ações Automáticas (CronTask)
aliases: [CronTask, ações automáticas, jobs, cron]
tags: [infra, cron, jobs, dominio/operacao]
type: job
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-1-037 · CronTask ações automáticas interno externo|EV-1-037]]"
author: CAD Discovery
created: 2026-07-10
---

# Ações Automáticas (CronTask)

As tarefas em segundo plano do GLPI são **CronTasks** registradas por cada módulo
(`CronTask::register(itemtype, name, frequency)`), executadas em dois modos:

- **Interno** (`MODE_INTERNAL`) — disparado durante acessos web (sem cron do SO; simples,
  porém dependente de tráfego).
- **Externo** (`MODE_EXTERNAL`) — via **cron do sistema** chamando `front/cron.php`
  (recomendado em produção). Locks em `GLPI_CRON_DIR` evitam concorrência.

## Exemplos de ações automáticas (resolvem investigações abertas)
- **Fila de notificações** — drena `QueuedNotification` ([[Notificações (e-mail e canais)]]).
- **Escalonamento de SLA** — dispara níveis de `SlaLevel`/`OlaLevel`
  ([[INV-1-004 · Ações de escalonamento de SLA]]).
- **Alertas** de vencimento de contrato/garantia e **estoque baixo**
  ([[INV-1-008 · Alertas e crons de vencimento]]).
- **Sincronização LDAP**, coleta de e-mail ([[Coletor de E-mail (MailCollector)]]),
  fechamento automático de chamados, limpeza de inventário/logs.

Cada `CronTask` tem frequência, última execução, estado e log de execução (`CronTaskLog`).
