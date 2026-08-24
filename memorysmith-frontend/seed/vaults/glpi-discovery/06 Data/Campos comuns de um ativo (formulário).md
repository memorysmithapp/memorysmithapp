---
title: Campos comuns de um ativo (formulário)
aliases: [Common fields, Campos comuns de ativo]
tags: [assets, data, common-fields, form]
type: entity
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-c1-003 · Formulário e abas de Computador|EV-2-c1-003]]"
  - "[[EV-2-c1-004 · Formulário de Monitor e gestão unitária vs global|EV-2-c1-004]]"
  - "[[EV-2-c1-005 · Formulário e abas de Periférico|EV-2-c1-005]]"
  - "[[EV-2-c1-006 · Formulário e abas de Telefone|EV-2-c1-006]]"
  - "[[EV-2-c1-007 · Formulário e abas de Impressora|EV-2-c1-007]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos comuns de um ativo (formulário)

O doc documenta os campos básicos como *common fields* reutilizados entre os tipos de ativo (referenciados em `tabs/common_fields/*`). O núcleo compartilhado é:

| Campo | Significado |
|---|---|
| **Name** | Nome do ativo |
| **Location** | Localização (dropdown hierárquico) |
| **Technician in charge** | Técnico responsável |
| **Group in charge** | Grupo responsável |
| **Alternate username number** | Nº de usuário alternativo |
| **Alternate username** | Usuário alternativo (texto) |
| **User** | Usuário associado |
| **Group** | Grupo associado |
| **Comments** | Comentários |
| **Status** | Estado do item (ver [[Status de itens (visão específica)]]) |
| **<Tipo> type** | Tipo do ativo (Computer/Monitor/Phone/Printer type; "Device type" no periférico) |
| **Manufacturer** | Fabricante |
| **Model** | Modelo |
| **Serial number** | Número de série |
| **Inventory number** | Número de inventário |
| **Network** | Rede |
| **UUID** | Identificador único |
| **Update source** | Fonte de atualização |
| **Management type** | Gestão unitária/global (nem todos os tipos) — ver [[Gestão unitária vs global de ativos (visão do doc)]] |

> [!note] Variações por tipo
> - **Computador** não tem `Management type` (sempre unitário) e adiciona campos de agente quando inventariado (Agents, Last contact, Inventory tag...).
> - **Monitor** adiciona `Size` e `Ports`; **Telefone** adiciona `Brand`, `Number of lines`, `Ports`.
> - **Impressora** adiciona `Sysdescr`, `SNMP Credentials`, `Memory`.
> - **SIM** e **Ativo não gerenciado** têm conjuntos próprios (ver notas específicas).

## Ponte doc × código
Materializa, na perspectiva de formulário, o [[Modelo de Ativos (padrão comum)]] implementado em código. Campos de dropdown (Location, Manufacturer, Model, Type...) são [[Dropdown (lista suspensa customizável)|dropdowns customizáveis]] (E1).
</content>
