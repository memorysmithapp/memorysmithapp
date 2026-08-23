---
title: EV-2-g4-009 · Campos de estoque e consumíveis (limite de alerta, estoque-alvo, tipo de cartucho)
aliases: [EV-2-g4-009]
tags: [evidence, campos-comuns, estoque, consumiveis, cartucho, alerta]
type: evidence
status: confirmed
source: "SRC-002 · tabs/common_fields/alert_threshold.rst · Alert threshold; tabs/common_fields/stock_target.rst · Stock target; tabs/common_fields/cartridge_type.rst · Cartridge Type"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-g4-009 · Estoque e consumíveis

> [!quote] Alert threshold (`alert_threshold.rst`)
> "The alert threshold is the minimal value at which an alert is triggered. You can set this field between never and 100." Distingue-se do **restock threshold** (quantidade desejada em estoque após pedido). Exemplo: alarme em 2, restock em 10 → a notificação informa quantas unidades pedir para atingir 10 (configurável em templates de notificação). Requer notificações ativadas. Estoque compartilhado é possível tornando o elemento recursivo numa entidade (disponível para sub-entidades). Um cartucho só é instalável numa impressora se declarado compatível.

> [!quote] Stock target (`stock_target.rst`)
> "This option allows you to define an inventory management threshold ... the ideal minimum quantity you want to keep in your inventory. If the actual stock falls below this threshold, this can trigger notifications." Ex.: valor mínimo 10; se o estoque atual < estoque-alvo, o GLPI gera um alerta. Ajuda administradores a monitorar e planejar compras.

> [!quote] Cartridge Type (`cartridge_type.rst`)
> "This field defines the type of cartridge (laser, inkjet, etc.)." Criação via **+** → Name → comentário (opcional) → **+ Add**. Listagem via **i** ou **Setup > Dropdowns > Cartridge types**; exclusão via "delete permanently" ou ações massivas.

## Sustenta
- [[Limite de alerta (alert threshold)]]
- [[Estoque-alvo (stock target)]]
- [[Tipo de cartucho (cartridge type)]]
