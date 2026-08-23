---
title: EV-2-f3-004 · Configuração de e-mail (follow-ups) global e por entidade
aliases: [EV-2-f3-004]
tags: [evidence, email, smtp, notificacao, config]
type: evidence
status: confirmed
source: "SRC-002 · modules/configuration/notifications/email_notifications.rst · Email follow-ups configuration"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f3-004 · Configuração de e-mail (follow-ups) global e por entidade

> [!quote] email_notifications.rst · "Email follow-ups configuration"
> Para o GLPI enviar notificações por e-mail é preciso configurar a conexão com um servidor de e-mail. A configuração pode ser feita **globalmente** e alguns valores podem ser **sobrescritos no nível da entidade**. Acesso global: opção "Email followups configuration" em **Setup > Notifications**.

> [!quote] Configuração global (opções e significado)
> - **Administrator email** / **Administrator name**: e-mail e nome do administrador GLPI (usável como destinatário especial).
> - **From email** / **From name**: endereço e nome usados no campo From (o nome é visto pelo usuário final).
> - **Reply-to address** / **Reply-to name**: endereço/nome para respostas.
> - **No-Reply address** / **No-Reply name**: para e-mails que não devem ser respondidos.
> - **Add documents into ticket notifications**: se habilitado, documentos anexados ao ticket são adicionados como links nas notificações (usa a URL do GLPI da config geral).
> - **Email signature**: texto ao fim de toda notificação.
> - **Way of sending emails**: método de envio (PHP, SMTP, SMTP+SSL, SMTP+TLS).
> - **Max delivery retries**: número de tentativas de envio.
> - **Try to deliver again in (minutes)**: intervalo entre tentativas.
>
> É possível testar o envio a partir do formulário global, enviando um e-mail ao Administrator email.

> [!quote] Métodos de envio
> - **PHP**: usa a função `mail()`; não configurável dentro do GLPI (config no PHP); geralmente bloqueado por provedores de hospedagem.
> - **SMTP** (e SMTP+SSL / SMTP+TLS): Check certificate; SMTP host; Port (tipicamente 25); SMTP login/password (opcionais); Email sender (opcional, usa Administrator email se vazio). SSL/TLS aplicam a segurança correspondente. Provedores que exigem IMAP OAuth podem precisar de config extra.

> [!quote] Configuração por entidade (aba "Notifications" da entidade)
> Sobrescrevíveis por entidade: Administrator email/name, Reply-to address/name, Email signature.
> Configuráveis **apenas** por entidade: **Prefix for notifications** (prefixo do assunto), **Delay to send email notifications** (atraso opcional no envio inicial), **Enable notifications by default** (usuário passa a receber notificações automaticamente em certos casos, ex.: ao ser atribuído a um ticket).
> Campos não definidos são herdados da entidade pai.

## Sustenta
- [[Campos da configuração de e-mail (follow-ups)]]
- [[Notificações no GLPI (visão de configuração)]]
