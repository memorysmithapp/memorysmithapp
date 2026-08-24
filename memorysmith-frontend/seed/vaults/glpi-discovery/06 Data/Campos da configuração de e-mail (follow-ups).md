---
title: Campos da configuração de e-mail (follow-ups)
aliases: [Email follow-ups fields, SMTP config fields]
tags: [dados, email, smtp, config, campos, entidade]
type: entity
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-004 · Configuração de e-mail (follow-ups) global e por entidade|EV-2-f3-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos da configuração de e-mail (follow-ups)

Semântica dos campos da configuração de e-mail (Setup > Notifications > Email followups configuration).

## Configuração global
| Campo | Significado |
|---|---|
| Administrator email / name | E-mail e nome do administrador GLPI (destinatário especial em notificações). |
| From email / name | Endereço e nome do campo From (o nome é visto pelo usuário final). |
| Reply-to address / name | Endereço/nome usado quando o usuário responde. |
| No-Reply address / name | Para e-mails que não devem ser respondidos. |
| Add documents into ticket notifications | Se habilitado, anexos do ticket são adicionados como links (usa a URL do GLPI da config geral). |
| Email signature | Texto ao fim de toda notificação. |
| Way of sending emails | Método: PHP, SMTP, SMTP+SSL, SMTP+TLS. |
| Max delivery retries | Nº de tentativas de envio. |
| Try to deliver again in (minutes) | Intervalo entre tentativas. |

## Método PHP
Usa `mail()` do PHP; configurado no PHP (não no GLPI); geralmente bloqueado por provedores de hospedagem.

## Método SMTP (e +SSL / +TLS)
Check certificate; SMTP host; Port (tipicamente 25); SMTP login/password (opcionais); Email sender (opcional; usa Administrator email se vazio). SSL/TLS aplicam a segurança correspondente. IMAP OAuth pode exigir config extra.

## Configuração por entidade (aba Notifications da entidade)
- **Sobrescrevíveis**: Administrator email/name, Reply-to address/name, Email signature.
- **Só na entidade**: Prefix for notifications (prefixo do assunto); Delay to send email notifications (atraso inicial opcional); Enable notifications by default (usuário passa a receber notificações automaticamente, ex.: ao ser atribuído a um ticket).
- Campos não definidos são herdados da entidade pai.

## Ver também
- [[Notificações no GLPI (visão de configuração)]]
- [[Modelo de Entidades (multi-tenancy)]]
