---
title: Fluxo de notificação (event → fila → envio)
aliases: [Fluxo de notificação, notification flow]
tags: [flow, notificacoes, dominio/integracoes]
type: flow
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-035 · Notificações event template target queue|EV-1-035]]"
  - "[[EV-1-037 · CronTask ações automáticas interno externo|EV-1-037]]"
author: CAD Discovery
created: 2026-07-10
---

# Fluxo de notificação (event → fila → envio)

Deriva de [[Notificações (e-mail e canais)]] e [[Ações Automáticas (CronTask)]].

```mermaid
sequenceDiagram
    participant IT as Item (ex.: Ticket)
    participant NE as NotificationEvent
    participant N as Notification (regra)
    participant Q as QueuedNotification
    participant CR as CronTask (queuednotification)
    participant MTA as SMTP / canal

    IT->>NE: evento (new / update / solved)
    NE->>N: casa notificações do itemtype+evento
    N->>N: resolve alvos (atores/grupos/e-mails) + template
    N->>Q: enfileira mensagem(ns) renderizada(s)
    CR->>Q: lê pendentes (por frequência)
    CR->>MTA: envia (e-mail/ajax/...)
    MTA-->>CR: status → marca enviado/erro
```

O desacoplamento por **fila** garante que picos de eventos não bloqueiem a UI e permite
reentrega em falhas.
