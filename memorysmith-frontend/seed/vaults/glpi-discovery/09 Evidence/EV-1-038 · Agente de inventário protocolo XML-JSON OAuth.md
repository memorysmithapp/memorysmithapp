---
title: EV-1-038 · Agente de inventário — protocolo XML/JSON, OAuth
aliases: [EV-1-038]
tags: [evidence, dominio/integracoes, inventario, agente]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-001 · src/Glpi/Agent/Communication/AbstractRequest.php L69–90 · src/Agent.php"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-038 · Agente de inventário — protocolo XML/JSON, OAuth

> [!quote] `src/Glpi/Agent/Communication/AbstractRequest.php`
> ```php
> // "Handle agent requests. Both XML (legacy) and JSON inventory formats are supported."
> // @see inventory_format/blob/master/inventory.schema.json
> abstract class AbstractRequest {
>     const XML_MODE = 0;  const JSON_MODE = 1;
>     const PROLOG_QUERY='prolog'; const INVENT_QUERY='inventory'; const SNMP_QUERY='snmp';
>     const CONTACT_ACTION='contact'; const REGISTER_ACTION='register';
> }
> // usa Glpi\OAuth\Server (autenticação) e gzip (compressão)
> ```

Resolve [[INV-1-007 · Protocolo e endpoint do agente de inventário]]: o agente comunica-se por
HTTP com o GLPI enviando inventário em **XML** (legado FusionInventory) ou **JSON** (schema
`inventory_format`). Fluxo em fases: **contact/prolog** (handshake), **inventory** (dados),
**snmp** (descoberta de rede). Suporta **compressão gzip** e **autenticação OAuth2**. Cada
agente é registrado como `Agent` e vinculado ao ativo.

## Sustenta
- [[Agente de Inventário (protocolo)]]
- [[INV-1-007 · Protocolo e endpoint do agente de inventário]]
