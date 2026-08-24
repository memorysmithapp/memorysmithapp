---
title: EV-1-035 · Notificações — event/template/target/queue
aliases: [EV-1-035]
tags: [evidence, dominio/integracoes, notificacoes]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-001 · src/Notification.php L44 · src/NotificationTemplate.php L47 · src/NotificationTarget.php L44 · src/QueuedNotification.php L48 · src/NotificationEventMailing.php"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-035 · Notificações — event/template/target/queue

> [!quote] classes (grep confirmado)
> ```php
> class Notification extends CommonDBTM implements FilterableInterface {}  // regra: evento→quem→template
> class NotificationEvent extends CommonDBTM {}      // catálogo de eventos por itemtype
> class NotificationTemplate extends CommonDBTM {}    // template (traduzível, HTML/texto)
> class NotificationTarget extends CommonDBChild {}   // destinatários (papéis, grupos, e-mails)
> class QueuedNotification extends CommonDBTM {}       // fila/outbox de envios
> class NotificationEventMailing ...                   // canal e-mail (há canais ajax, etc.)
> ```

O motor de notificações liga um **evento** (ex.: `new`, `update`, `solved` de um chamado) a
**alvos** (solicitante, técnico, grupo, e-mail fixo — reusando os [[Modelo de Atores ITIL|atores]])
e a um **template** traduzível. Os envios são **enfileirados** (`QueuedNotification`) e
despachados por **cron** ([[Ações Automáticas (CronTask)]]) através de um **canal**
(e-mail/SMTP, navegador/ajax…). É configurável por entidade.

## Sustenta
- [[Notificações (e-mail e canais)]]
- [[Fluxo de notificação (event → fila → envio)]]
