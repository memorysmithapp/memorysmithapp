---
title: EV-2-e2-004 · Entidade - Notificações e Alarmes (herança)
aliases: [EV-2-e2-004]
tags: [evidence, entidades, notificacoes, alarmes, heranca, doc]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/administration/entity/entities.rst · Notifications"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] Documentação (entities.rst, aba Notifications)
> "Notification setting is done at entity level."

**Opções de notificação** (por entidade): endereço e nome do administrador; endereço e nome do remetente; No-reply address/name; Reply-to address/name; **Prefixo** das notificações; **Delay** para enviar notificações (herança da entidade-pai ou atraso em minutos); **Habilitar notificações por padrão** (No/Yes/Herança); assinatura de e-mail; URL da aplicação.

> [!note] Delay
> Para cada entidade pode-se definir o atraso antes de enviar a notificação. Esse atraso permite, em caso de múltiplas modificações rápidas de um ticket, enviar apenas um e-mail. O acompanhamento por e-mail de um ator também pode ser Sim/Não.

**Opções de Alarmes** (herança da entidade-pai como valor padrão; se não for desejável refinar por entidade, define-se uma vez na raiz). `.. warning::` cada opção de alerta está associada a uma **ação automática**; se a ação for desabilitada pelo administrador GLPI, nenhuma notificação é enviada.

Categorias de alarme e seus valores (todas com opção *Inheritance of the parent entity*):
- **Cartridges**: frequência de lembretes (Never/Each day/week/month); limiar padrão de contagem (never / 0..100).
- **Consumables**: frequência de lembretes; limiar padrão de contagem.
- **Contacts**: alarmes (No/Yes/Herança); valor padrão (End/Notice/End+notice/Period end/Period end+notice); enviar alarmes antes (No / 1..365 dias).
- **Financial and administrative information**: alarmes; valor padrão (Warranty expiration date); enviar antes (1..365 dias).
- **Licenses**: alarmes sobre licenças expiradas; enviar antes (1..365 dias).
- **Certificates**: alarmes sobre certificados expirados; enviar antes (1..365 dias); frequência de lembretes.
- **Reservations**: alertas (No/Herança / 1..365 horas).
- **Tickets**: alertas para tickets não resolvidos desde (1..365 dias).
- **Tickets / Changes**: frequência de lembrete de aprovação (Never/day/week/month).
- **Domains**: alarmes sobre expirações; "Domain closes expiries" e "Domains expired" (1..365 dias).

## Sustenta
- [[Campos de notificação e alarmes da entidade]]
- [[Herança de configuração entre entidades (fluxo)]]
- [[Fila de e-mails (mailqueue)]]
