---
title: INV-1-008 · Alertas e crons de vencimento
aliases: [INV-1-008]
tags: [investigation, consumidor/cad, financeiro, cron]
type: investigation
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-023 · Contract com renovação alerta custos e vínculo a itens|EV-1-023]]"
  - "[[EV-1-037 · CronTask ações automáticas interno externo|EV-1-037]]"
author: CAD Discovery
created: 2026-07-10
---

# INV-1-008 · Alertas e crons de vencimento

> [!success] Resolvida (mecanismo — Módulo 6)
> Os alertas são **CronTasks** registradas pelos itemtypes (contrato, Infocom/garantia,
> licença, consumível), que avaliam a antecedência configurada (herdada da entidade) e
> enfileiram **notificações** ([[Notificações (e-mail e canais)]]) aos alvos. Mecanismo em
> [[Ações Automáticas (CronTask)]] e [[EV-1-037 · CronTask ações automáticas interno externo|EV-1-037]].
> _Resta enumerar cada cron específico e sua antecedência default (detalhe de configuração)._

> [!question] Pergunta original
> Quais crons/alertas notificam vencimento de contrato, garantia, licença e estoque baixo.
