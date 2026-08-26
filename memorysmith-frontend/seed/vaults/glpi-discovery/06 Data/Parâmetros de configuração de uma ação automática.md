---
title: Parâmetros de configuração de uma ação automática
aliases: [Automatic action fields, Crontask config fields]
tags: [dados, crontask, acao-automatica, campos, config]
type: entity
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-007 · Ações automáticas (crontasks) — config e catálogo|EV-2-f3-007]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Parâmetros de configuração de uma ação automática

Campos configuráveis por ação (aba **Automatic action** do formulário):

| Parâmetro | Significado |
|---|---|
| Run frequency | Frequência de execução. |
| Status | Habilita/desabilita a ação. |
| Run mode | Modo de execução: **GLPI** (disparado na navegação) ou **CLI** (agendador externo via `front/cron.php`). |
| Run period | Período de execução (ex.: desabilitar à noite). |
| Number of days logs stored | Retenção dos logs desta ação. |

A interface permite ainda **resetar a data de execução** e **forçar a execução manualmente**. Algumas ações têm parâmetros próprios (ex.: máximo de e-mails por vez na ação de fila de e-mail). Plugins podem definir suas próprias ações automáticas.

Outras abas: **Statistics** (nº de execuções, datas e durações mín/máx/média/total) e **Logs** (últimas execuções, com detalhe por data). Ação da lista: **Reset last run**.

## Ver também
- [[Catálogo de ações automáticas (crontasks)]]
- [[Configuração do modo CLI de ações automáticas (cron.php)]]
- [[Ações Automáticas (CronTask)]]
