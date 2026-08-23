---
title: Fila de e-mails (mailqueue)
aliases: [Mailing queue, Fila de notificações, queuedmail]
tags: [notificacoes, fila, email, crontask, doc]
type: component
status: confirmed
source: "[[EV-2-e2-018 · Fila de e-mails (mailing queue)|EV-2-e2-018]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Todos os **e-mails de notificação passam por uma fila** antes da entrega efetiva, o que mantém histórico e lista dos e-mails enviados.

## Ações automáticas
- **`queuedmail`**: envia os e-mails pendentes;
- **`queuemailclean`**: limpa a fila mantendo apenas e-mails recentes.

Ver [[Ações Automáticas (CronTask)]].

## Comportamento
- O **delay** de envio é definido por **entidade** (aba Notifications — ver [[Campos de notificação e alarmes da entidade]]); permite consolidar múltiplas modificações rápidas de um objeto em uma só notificação.
- A fila **não** se aplica ao change/problem/ticket em si, **apenas a sub-objetos**: mudar o impacto de um ticket envia o e-mail imediatamente; adicionar/modificar follow-up, tarefa ou pedido de validação coloca o e-mail na fila.
- Enviada a notificação, a entrada vai para a **lixeira** com a data de envio; há tantas entradas quantos destinatários.

> [!note] Ponte doc×código
> Corresponde à etapa de fila do código [[Fluxo de notificação (event → fila → envio)]] e à capacidade [[Notificações (e-mail e canais)]]. Ver o fluxo [[Fila de e-mails (fluxo)]].
