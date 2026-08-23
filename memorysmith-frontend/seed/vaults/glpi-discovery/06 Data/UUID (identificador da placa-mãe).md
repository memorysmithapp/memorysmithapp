---
title: UUID (identificador da placa-mãe)
aliases: [UUID, Universally Unique IDentifier]
tags: [campos-comuns, identificacao, inventario, data]
type: field
status: confirmed
source: "[[EV-2-g4-001 · Campos de identificação de inventário (série, UUID, nº inventário, fonte)|EV-2-g4-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# UUID (identificador da placa-mãe)

Campo comum que guarda o **UUID** (Universally Unique IDentifier), identificador único da **placa-mãe** do equipamento. É atualizado automaticamente pelo [[Fluxo de inventário nativo]].

> [!note] Bloqueio
> Ao adicionar ou modificar o UUID manualmente, o campo é **bloqueado (locked)** por padrão — o inventário automático deixa de sobrescrevê-lo. O bloqueio pode ser removido.

Valores podem ser obtidos no equipamento via `dmidecode` (Linux), `wmic path win32_computersystemproduct get uuid` (Windows) ou Apple Logo > About This Mac > System report > Hardware UUID (Mac).
