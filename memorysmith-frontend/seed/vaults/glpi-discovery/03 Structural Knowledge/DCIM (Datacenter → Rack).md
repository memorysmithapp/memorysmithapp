---
title: DCIM (Datacenter → Rack)
aliases: [DCIM, Datacenter, Rack, Enclosure, PDU]
tags: [concept, dcim, dominio/ativos]
type: concept
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-1-019 · DCIM Datacenter Rack Item_Rack|EV-1-019]]"
author: CAD Discovery
created: 2026-07-10
---

# DCIM (Datacenter → Rack)

O **Data Center Infrastructure Management** modela a **localização física** dos ativos numa
hierarquia:

**Datacenter → DCRoom (sala) → Rack → posição U (`Item_Rack`)**

- **Rack** tem número de unidades (U), e `Item_Rack` posiciona um ativo numa posição
  (frente/verso, ocupando N U's) — sustenta a visão gráfica drag-and-drop.
- **Enclosure** — chassis/blade que agrupa ativos.
- **PDU** — unidade de distribuição de energia.
- O trait **DCBreadcrumb** ([[Modelo de Ativos (padrão comum)]]) reconstrói a trilha
  Datacenter › Sala › Rack › U de qualquer ativo montado.

Complementa o CMDB com a dimensão espacial/energética, útil para capacidade e manutenção.
