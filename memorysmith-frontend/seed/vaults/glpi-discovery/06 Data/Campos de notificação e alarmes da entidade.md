---
title: Campos de notificação e alarmes da entidade
aliases: [Entity notification fields, Alarmes da entidade]
tags: [entidades, campos, notificacoes, alarmes, heranca, dados, doc]
type: table
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-e2-004 · Entidade - Notificações e Alarmes (herança)|EV-2-e2-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Campos da aba **Notifications** de uma entidade. Muitos admitem *Inheritance of the parent entity* — ver [[Herança de configuração entre entidades (fluxo)]].

## Notification options
- Administrator email address / name;
- Email sender email address / name;
- No-reply address / name;
- Reply-to address / name;
- **Prefix** for notifications;
- **Delay** to send email notifications (herança ou minutos) — base da [[Fila de e-mails (mailqueue)]];
- **Enable notifications by default** (No/Yes/Herança);
- Email signature;
- URL of the application.

## Alarms options (por categoria)
- **Cartridges / Consumables**: frequência de lembretes (Never/Each day/week/month); limiar padrão de contagem (never / 0..100).
- **Contacts**: alarmes (No/Yes/Herança); valor padrão (End/Notice/End+notice/Period end/…); enviar antes (1..365 dias).
- **Financial and administrative information**: alarmes; valor padrão (Warranty expiration date); enviar antes (1..365 dias).
- **Licenses**: alarmes sobre licenças expiradas; enviar antes (1..365 dias).
- **Certificates**: alarmes; enviar antes (1..365 dias); frequência de lembretes.
- **Reservations**: alertas (1..365 horas).
- **Tickets**: alertas para não resolvidos desde (1..365 dias).
- **Tickets / Changes**: frequência de lembrete de aprovação.
- **Domains**: alarmes de expiração; "closes expiries" e "expired" (1..365 dias).

> [!warning] Cada alarme depende de uma ação automática associada; se desabilitada, nenhuma notificação é enviada.
