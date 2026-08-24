---
title: Limite de alerta (alert threshold)
aliases: [Alert threshold, Limite de alerta, Restock threshold]
tags: [campos-comuns, estoque, consumiveis, alerta, data]
type: field
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-g4-009 · Campos de estoque e consumíveis (limite de alerta, estoque-alvo, tipo de cartucho)|EV-2-g4-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Limite de alerta (alert threshold)

Campo comum de consumíveis/cartuchos que define o **valor mínimo** a partir do qual um alerta é disparado (configurável entre *never* e 100). Distingue-se do **restock threshold**, que representa a quantidade desejada em estoque após um pedido.

> [!example] Exemplo
> Alarme = 2, restock = 10: a notificação, ao disparar, informa a quantidade a pedir para atingir 10 (texto configurável em templates de notificação).

Requer notificações ativadas. O estoque compartilhado é possível ao tornar o elemento **recursivo** numa entidade (ver [[Recursividade em entidades]]) — fica disponível para as sub-entidades. Um cartucho só é instalável numa impressora se declarado compatível. Ver também [[Estoque-alvo (stock target)]].
