---
title: Infocom (dados financeiros do ativo)
aliases: [Infocom, dados financeiros, garantia, depreciação]
tags: [concept, financeiro, dominio/ativos]
type: concept
maturity: evergreen
reviewed: false
source: "[[EV-1-020 · Infocom dados administrativos e financeiros do ativo|EV-1-020]]"
author: CAD Discovery
created: 2026-07-10
---

# Infocom (dados financeiros do ativo)

**Infocom** é o registro **administrativo/financeiro** anexável a qualquer item (polimórfico,
`CommonDBChild` por `itemtype`/`items_id`). Reúne:

- **Compra**: fornecedor, nº de pedido/nota/entrega, datas (compra, uso, entrega), valor.
- **Garantia**: duração, data de início, informações e **alertas** de expiração.
- **Depreciação**: tipo (linear/decrescente), duração, coeficiente, valor residual — o GLPI
  calcula o valor contábil atual.
- **Orçamento** e **centro de custo** (liga à [[Gestão Financeira de TI]] — Módulo 4).

É criado automaticamente para itens elegíveis no ciclo de vida ([[EV-1-001 · CommonDBTM é o active-record base com ciclo add-update-delete|EV-1-001]]) e é a principal
ponte entre o CMDB e a gestão financeira/contratos.
