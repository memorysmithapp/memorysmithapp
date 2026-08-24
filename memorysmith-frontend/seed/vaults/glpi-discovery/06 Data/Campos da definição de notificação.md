---
title: Campos da definição de notificação
aliases: [Notification definition fields]
tags: [dados, notificacao, campos, definicao]
type: entity
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-002 · Definição de notificação e destinatários|EV-2-f3-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos da definição de notificação

Campos da aba **Notification** de uma [[Definição de notificação (estrutura)]]:

| Campo | Significado |
|---|---|
| Name | Nome da notificação. |
| Active | Permite desativar temporariamente a notificação. |
| Type | Tipo de objeto GLPI ao qual a notificação se refere. |
| Notification mode | Método de notificação (Email e Browser por padrão). |
| Event | Evento disparador conforme o tipo do objeto (ex.: Add). |

Além dessa aba, a definição tem a aba **Notification templates** (qual template usar para o tipo/evento) e a aba **Recipients** (ver [[Destinatários de notificação (recipients)]]).

## Ver também
- [[Campos do template de notificação]]
- [[Modos de notificação (e-mail e navegador)]]
