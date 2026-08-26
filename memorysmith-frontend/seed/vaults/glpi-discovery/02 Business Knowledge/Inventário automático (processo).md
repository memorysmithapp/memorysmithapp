---
title: Inventário automático (processo)
aliases: [Inventário, Native Inventory, agente]
tags: [process, inventario, dominio/ativos]
type: process
maturity: evergreen
reviewed: false
source: "[[EV-1-021 · Inventário nativo orquestra parsers InventoryAsset|EV-1-021]]"
author: CAD Discovery
created: 2026-07-10
---

# Inventário automático (processo)

Processo que mantém o CMDB atualizado automaticamente a partir de **agentes** instalados nos
ativos (ou descoberta de rede). Nativo no GLPI desde a v10.

## Fluxo
1. Um **agente** (GLPI Agent) coleta hardware/software e envia um documento de inventário
   (JSON/XML) ao endpoint do GLPI.
2. A classe `Inventory` ([[EV-1-021 · Inventário nativo orquestra parsers InventoryAsset|EV-1-021]]) identifica o **MainAsset** (Computer, Phone,
   NetworkEquipment, Printer) e o **concilia** com um ativo existente (por serial/UUID) ou cria.
3. Cada seção é processada por um **parser** `InventoryAsset` (processador, memória, software,
   portas, SO…) que cria/atualiza os itens-filhos, com deduplicação.
4. **Regras de importação/atribuição** (motor de regras, Módulo 5) decidem entidade, estado,
   descarte de campos e casamento com ativos existentes.

Ver a orquestração em [[Fluxo de inventário nativo]]. O protocolo/endpoint exato do agente
fica para o Módulo 6 — ver [[INV-1-007 · Protocolo e endpoint do agente de inventário]].
