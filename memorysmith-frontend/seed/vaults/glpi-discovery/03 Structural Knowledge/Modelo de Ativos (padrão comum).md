---
title: Modelo de Ativos (padrão comum)
aliases: [Ativos, Assets, CMDB, padrão de ativo]
tags: [concept, cmdb, dominio/ativos]
type: concept
status: confirmed
source:
  - "[[EV-1-015 · Ativos herdam CommonDBTM com traits Assignable-State-Inventoriable|EV-1-015]]"
  - "[[EV-1-016 · Composição do ativo via Item_Devices e itens filhos|EV-1-016]]"
author: CAD Discovery
created: 2026-07-10
---

# Modelo de Ativos (padrão comum)

O CMDB do GLPI é um conjunto de **itemtypes de ativo** que compartilham um padrão único.
Ativos "principais": **Computer, Monitor, NetworkEquipment, Peripheral, Phone, Printer** e os
de datacenter **Rack, Enclosure, PDU** (ver [[DCIM (Datacenter → Rack)]]).

## Padrão compartilhado (traits/interfaces)
Todo ativo estende [[CommonDBTM (Active Record)]] e combina:
- **AssignableItem** — atribuição a usuário/grupo responsável.
- **State** — status do ciclo de vida do ativo (`StateInterface`).
- **Inventoriable** — pode ser preenchido pelo [[Inventário automático (processo)]].
- **DCBreadcrumb** — localização física em datacenter.
- **Clonable** — clonagem com relações.
- Bloco de notas (`usenotepad`) e histórico (`dohistory = true`).

## Atributos comuns
Nome, número de série/inventário, **estado**, **localização**, **entidade**, fabricante,
modelo, tipo, grupo/usuário técnico, comentários — via dropdowns compartilhados.

## Composição
Cada ativo é um agregado de itens-filhos — ver [[Composição de um Ativo (componentes)]],
[[Rede (portas, IP, VLAN)]], [[Software, Versões e Licenças]] e [[Infocom (dados financeiros do ativo)]].

> [!note]
> O GLPI 11 permite ainda **novos tipos de ativo por configuração** —
> ver [[Ativos Customizáveis (AssetDefinition)]].
