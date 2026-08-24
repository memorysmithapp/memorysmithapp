---
title: INV-1-007 · Protocolo e endpoint do agente de inventário
aliases: [INV-1-007]
tags: [investigation, consumidor/cad, inventario, integracao]
type: investigation
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-021 · Inventário nativo orquestra parsers InventoryAsset|EV-1-021]]"
  - "[[EV-1-038 · Agente de inventário protocolo XML-JSON OAuth|EV-1-038]]"
author: CAD Discovery
created: 2026-07-10
---

# INV-1-007 · Protocolo e endpoint do agente de inventário

> [!success] Resolvida (Módulo 6)
> O agente comunica-se por HTTP em **XML** (legado) ou **JSON** (schema `inventory_format`),
> em fases `contact`/`prolog` → `inventory` → `snmp`, com **OAuth2** e **gzip**. Detalhe em
> [[Agente de Inventário (protocolo)]] e [[EV-1-038 · Agente de inventário protocolo XML-JSON OAuth|EV-1-038]].

> [!question] Pergunta original
> Endpoint, formato, autenticação e tratamento da comunicação do agente.
