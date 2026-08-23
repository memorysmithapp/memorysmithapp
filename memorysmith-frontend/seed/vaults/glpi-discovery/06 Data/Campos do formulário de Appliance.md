---
title: Campos do formulário de Appliance
aliases: [Campos de Appliance, Appliance form fields]
tags: [management, appliance, campos, formulario, data]
type: entity
status: confirmed
source: "[[EV-2-d2-001 · Appliances (appliance.rst)|EV-2-d2-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos do formulário de Appliance

Campos do formulário de um [[Appliance (aplicação de negócio)]].

## Campos básicos (comuns)
Herdam os [[Campos comuns de um ativo (formulário)|campos comuns de ativo]]:
- **Name**
- **Status**, **Location**, **Technician in charge**, **Group in charge**, **Manufacturer**
- **Alternate username number**, **Alternate username**
- **Serial number**, **Inventory number**
- **User**, **Group**
- **Comments**

## Campos específicos
| Campo | Semântica |
|-------|-----------|
| **Appliance type** | Define o contexto do appliance (VOIP, EDM, etc.). Lista suspensa customizável (botão **+** para novo tipo). |
| **Appliance environment** | Ambiente da aplicação: produção, homologação (*acceptance*), pré-produção etc. Adaptável às necessidades. |
| **Pictures** | Imagem/foto anexável ao appliance. |

> [!note] O *Appliance type* e o *Appliance environment* são [[Dropdown (lista suspensa customizável)|dropdowns customizáveis]].
