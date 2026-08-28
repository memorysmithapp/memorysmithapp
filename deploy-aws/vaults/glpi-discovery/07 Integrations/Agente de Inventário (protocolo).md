---
title: Agente de Inventário (protocolo)
aliases: [Agente, GLPI Agent, protocolo de inventário]
tags: [integration, inventario, agente, dominio/integracoes]
type: integration
maturity: evergreen
reviewed: false
source: "[[EV-1-038 · Agente de inventário protocolo XML-JSON OAuth|EV-1-038]]"
author: CAD Discovery
created: 2026-07-10
---

# Agente de Inventário (protocolo)

Canal de entrada do [[Inventário automático (processo)]]. O **GLPI Agent** (instalado nos
ativos) comunica-se com o servidor por HTTP:

- **Formatos**: **XML** (legado FusionInventory) e **JSON** (schema `inventory_format`).
- **Fases/queries**: `contact`/`prolog` (handshake, obtém configuração e frequência),
  `inventory` (envia o inventário completo), `snmp` (descoberta de rede de equipamentos).
- **Ações**: `register`, `contact`.
- **Segurança**: autenticação **OAuth2**; **compressão gzip** no transporte.
- Cada agente é persistido como `Agent`, vinculado ao ativo e com data do último contato.

O documento recebido é processado pela classe `Inventory` ([[Fluxo de inventário nativo]]).
Resolve [[INV-1-007 · Protocolo e endpoint do agente de inventário]].
