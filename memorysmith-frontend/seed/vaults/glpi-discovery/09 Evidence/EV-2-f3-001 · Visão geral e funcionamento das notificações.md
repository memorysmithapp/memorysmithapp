---
title: EV-2-f3-001 · Visão geral e funcionamento das notificações
aliases: [EV-2-f3-001]
tags: [evidence, notificacao, notification, fila, queue]
type: evidence
status: confirmed
source: "SRC-002 · modules/configuration/notifications/index.rst · Notifications"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f3-001 · Visão geral e funcionamento das notificações

> [!quote] modules/configuration/notifications/index.rst · "Notifications"
> O GLPI possui um recurso de notificação que envia mensagens após um evento na aplicação, aos usuários via e-mail, notificações no navegador (*browser*) e outros métodos (expansíveis por plugins). O GLPI já vem com definições de notificação pré-definidas, utilizáveis imediatamente após habilitar as notificações. Para habilitar deve-se ativar **Enable followup** e então **Enable followup via email** ou **Browser followups** para exibir o menu de configurações.

> [!quote] Como funcionam as notificações (ex.: criação de ticket notificada por e-mail)
> 1. O ticket é criado no GLPI.
> 2. O GLPI procura notificações do evento "**ticket creation**" na entidade do ticket (senão nas entidades pai).
> 3. O GLPI monta a lista de destinatários conforme as configurações.
> 4. Para cada destinatário, o GLPI gera o e-mail no idioma do usuário se houver tradução, senão usa a "**Default translation**".
> 5. Os e-mails são colocados em **Administration > Notification queue**, aguardando envio pela ação automática ``queuednotification``.

> [!warning] Ao adicionar novas notificações via atualização do GLPI, elas são habilitadas por padrão.

O `index.rst` também lista a estrutura da seção: `templates`, `template_example`, `definitions`, `email_notifications`, `alarm_options`.

## Sustenta
- [[Notificações no GLPI (visão de configuração)]]
- [[Fluxo de notificação por e-mail (visão do usuário)]]
- [[Modos de notificação (e-mail e navegador)]]
