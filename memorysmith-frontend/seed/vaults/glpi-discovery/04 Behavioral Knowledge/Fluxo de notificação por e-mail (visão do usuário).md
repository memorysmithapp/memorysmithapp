---
title: Fluxo de notificação por e-mail (visão do usuário)
aliases: [Fluxo de notificação (doc)]
tags: [notificacao, fluxo, fila, queue, email]
type: flow
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-001 · Visão geral e funcionamento das notificações|EV-2-f3-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Fluxo de notificação por e-mail (visão do usuário)

Passo a passo descrito na documentação (exemplo: criação de ticket notificada por e-mail):

1. O **ticket é criado** no GLPI.
2. O GLPI procura [[Definição de notificação (estrutura)|notificações]] do evento "ticket creation" na **entidade do ticket** (senão nas **entidades pai**).
3. Monta a **lista de destinatários** conforme as configurações (ver [[Destinatários de notificação (recipients)]]).
4. Para cada destinatário, **gera o e-mail no idioma do usuário** se houver tradução, senão usa a **Default translation** do [[Template de notificação (objeto global)]].
5. Os e-mails são colocados em **Administration > Notification queue**, aguardando envio pela ação automática **`queuednotification`** (ver [[Catálogo de ações automáticas (crontasks)]]).

Este é o fluxo do ponto de vista de administrador/usuário; a implementação interna correspondente está em [[Fluxo de notificação (event → fila → envio)]].

> [!note] A separação entre geração (imediata, no evento) e envio (assíncrono, pela fila) explica por que notificações não saem instantaneamente: dependem da execução periódica de `queuednotification`.

## Ver também
- [[Modos de notificação (e-mail e navegador)]]
