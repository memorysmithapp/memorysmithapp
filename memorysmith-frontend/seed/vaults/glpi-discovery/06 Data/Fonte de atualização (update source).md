---
title: Fonte de atualização (update source)
aliases: [Update source, Fonte de atualização]
tags: [campos-comuns, inventario, dropdown, data]
type: field
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-g4-001 · Campos de identificação de inventário (série, UUID, nº inventário, fonte)|EV-2-g4-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Fonte de atualização (update source)

Campo comum que indica **como** o item foi incrementado no inventário. Se veio do agente, mostra **GLPI Native Inventory**; numa entrada manual, permanece vazio. É um [[Dropdown (lista suspensa customizável)]] no qual se podem criar fontes manuais (Nome + comentário opcional via **+**). Relaciona-se ao [[Fluxo de inventário nativo]].
