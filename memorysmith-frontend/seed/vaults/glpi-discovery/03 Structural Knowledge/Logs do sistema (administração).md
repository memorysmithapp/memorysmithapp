---
title: Logs do sistema (administração)
aliases: [Logs, Registro de eventos]
tags: [logs, auditoria, historico, doc]
type: component
status: confirmed
source: "[[EV-2-e2-017 · Logs|EV-2-e2-017]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

O menu **Logs** exibe e ordena os registros de eventos do GLPI.

A página de logs mostra, por evento:
- o **tipo de informação modificada** (computer, reservation, ticket…);
- a **data da modificação**;
- o **serviço GLPI** (inventory, configuration, tickets…);
- uma **mensagem** detalhando o evento.

## Configuração
- **Log Level**: campo na aba *System* da configuração geral.
- **Período de retenção**: parametrizado nas **ações automáticas** — ver [[Ações Automáticas (CronTask)]].

> [!note] Ponte doc×código
> Complementa o histórico por item da nota de código [[Ciclo de vida de um item (add-update-delete)]].
