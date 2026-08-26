---
title: Composição do ativo Computer (view)
aliases: [ER Computer, composição ativo]
tags: [view, cmdb, dados, dominio/ativos]
type: view
maturity: evergreen
reviewed: false
source: "[[EV-1-016 · Composição do ativo via Item_Devices e itens filhos|EV-1-016]]"
author: CAD Discovery
created: 2026-07-10
---

# Composição do ativo Computer (view)

Agregado típico de um [[Ticket|ativo]] Computer (deriva de
[[Composição de um Ativo (componentes)]]).

```mermaid
erDiagram
    COMPUTER ||--o{ ITEM_DEVICES : componentes
    COMPUTER ||--o{ ITEM_DISK : discos
    COMPUTER ||--o| ITEM_OPERATINGSYSTEM : SO
    COMPUTER ||--o{ NETWORKPORT : portas
    NETWORKPORT ||--o{ IPADDRESS : IPs
    COMPUTER ||--o{ ITEM_SOFTWAREVERSION : software_instalado
    COMPUTER ||--o{ ITEM_SOFTWARELICENSE : licencas
    COMPUTER ||--o{ ITEMVIRTUALMACHINE : VMs
    COMPUTER ||--o| INFOCOM : financeiro
    COMPUTER ||--o{ CONTRACT_ITEM : contratos
    COMPUTER ||--o{ DOCUMENT_ITEM : documentos
    COMPUTER ||--o{ ASSET_PERIPHERALASSET : perifericos
    COMPUTER }o--o| ITEM_RACK : posicao_dcim
    ITEM_DEVICES }o--|| DEVICEPROCESSOR : ex_processador
```
