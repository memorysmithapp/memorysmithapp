---
title: Fila de e-mails (fluxo)
aliases: [Mailqueue flow, Fluxo da fila de e-mails]
tags: [notificacoes, fila, email, fluxo, doc]
type: flow
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-e2-018 · Fila de e-mails (mailing queue)|EV-2-e2-018]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Fluxo de uma notificação de e-mail que passa pela fila.

## Passos
1. Um evento em um **sub-objeto** (follow-up, tarefa, pedido de validação…) gera uma notificação e a **coloca na fila** (`glpi_queuednotifications`). Eventos no próprio ticket/change/problem (ex.: mudança de impacto) são **enviados imediatamente**, sem fila.
2. A entrada aguarda o **delay** configurado na entidade (ex.: 20 min → data de envio = criação + 20 min). Isso consolida múltiplas modificações rápidas em uma só notificação.
3. A ação automática **`queuedmail`** envia os e-mails pendentes cuja data de envio chegou.
4. Enviada, a entrada é movida para a **lixeira** com a data de envio (uma entrada por destinatário).
5. A ação automática **`queuemailclean`** limpa a fila, mantendo apenas registros recentes.

```mermaid
flowchart LR
    E[Evento em sub-objeto] --> Q[Fila de e-mails]
    E2[Evento no ticket/change/problem] -->|imediato| S[Envio SMTP]
    Q -->|espera delay da entidade| C[queuedmail]
    C --> S
    S --> R[Lixeira com data de envio]
    R --> CL[queuemailclean limpa antigos]
```

> [!note] Ponte doc×código
> Detalha a etapa de fila do código [[Fluxo de notificação (event → fila → envio)]]. Ver [[Fila de e-mails (mailqueue)]], [[Campos de notificação e alarmes da entidade]] e [[Ações Automáticas (CronTask)]].
