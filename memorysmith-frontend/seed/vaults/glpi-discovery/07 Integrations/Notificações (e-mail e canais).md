---
title: Notificações (e-mail e canais)
aliases: [Notificações, Notification, e-mail, alertas]
tags: [integration, notificacoes, dominio/integracoes]
type: integration
maturity: evergreen
reviewed: false
source: "[[EV-1-035 · Notificações event template target queue|EV-1-035]]"
author: CAD Discovery
created: 2026-07-10
---

# Notificações (e-mail e canais)

Motor que avisa as pessoas certas quando algo acontece. Estrutura em quatro peças:

- **Notification** — a **regra**: para um `itemtype` + **evento** (ex.: chamado *novo*,
  *atribuído*, *solucionado*), define **alvos** e **template**.
- **NotificationTemplate** — o **conteúdo** (traduzível, HTML/texto), com variáveis do item
  (via Content Templates / Twig).
- **NotificationTarget** — **quem** recebe: papéis ([[Modelo de Atores ITIL|requester/assign/observer]]),
  grupos, gestores, e-mails fixos.
- **QueuedNotification** — a **fila** de envio, drenada por [[Ações Automáticas (CronTask)|cron]].

## Canais
E-mail (SMTP, com OAuth) via `NotificationEventMailing`; navegador/ajax; e webhooks/outros
conforme configuração. Tudo por entidade e filtrável.

Fluxo em [[Fluxo de notificação (event → fila → envio)]].
