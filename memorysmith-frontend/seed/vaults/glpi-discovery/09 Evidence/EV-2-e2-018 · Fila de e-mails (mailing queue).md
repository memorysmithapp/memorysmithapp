---
title: EV-2-e2-018 · Fila de e-mails (mailing queue)
aliases: [EV-2-e2-018]
tags: [evidence, notificacoes, fila, email, crontask, doc]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/administration/mailqueue.rst · Mailing queue"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] Documentação (mailqueue.rst)
> "All notification emails go through a queue before actual delivery. This allows keeping a history and a list of the various emails sent."

- Ação automática **`queuedmail`**: envia os e-mails pendentes.
- Ação automática **`queuemailclean`**: limpa a fila mantendo apenas e-mails recentes.
- O **delay** de envio é definido em nível de entidade (ver aba Notifications da entidade) — permite, em modificações rápidas múltiplas de um objeto, enviar apenas uma notificação.
- `.. warning::` a fila **não** funciona para um change/problem/ticket em si, **apenas para um sub-objeto**: mudar o impacto de um ticket envia o e-mail imediatamente; adicionar/modificar um follow-up, tarefa, pedido de validação → e-mail colocado na fila.
- Exemplo: delay de 20 minutos → data de envio = data de criação + 20 min.
- Uma vez enviada, a fila vai para a **lixeira** (recycle bin) com a data de envio. `.. note::` haverá tantas filas na lixeira quantos destinatários, cada uma com sua data de envio.

## Sustenta
- [[Fila de e-mails (mailqueue)]]
