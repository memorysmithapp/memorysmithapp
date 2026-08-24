---
title: Módulo de Ativos (Assets)
aliases: [Módulo Assets, Ativos]
tags: [assets, inventory, module, structural]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-c1-001 · Módulo Assets e tipos de ativo disponíveis|EV-2-c1-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Módulo de Ativos (Assets)

O módulo **Assets** do GLPI gerencia todos os ativos da infraestrutura de TI, adicionados manualmente ou trazidos pelo inventário automático. Ele permite listar nativamente todo o parque (hardware e software) e automatizar a coleta de informação via inventário nativo e **GLPI Agent**.

## Tipos de ativo disponíveis
Computers, Monitors, Softwares, Network equipments, Peripherals, Printers, Cartridges, Consumables, Phones, Racks, Enclosures, PDUs, Passive devices, [[Ativos não gerenciados (unmanaged assets)|Unmanaged assets]], Cables, SIM, [[Busca global de ativos (Global search)|Global (busca global)]].

Cada tipo tem seu formulário próprio; a maioria compartilha o [[Campos comuns de um ativo (formulário)|conjunto de campos comuns]] e as [[Abas comuns de um ativo (visão do usuário)|abas comuns]].

> [!note] Fusion Inventory
> O antigo plugin Fusion Inventory não é mais suportado. Recomenda-se o plugin **GLPI Inventory** (deploy de pacotes, inventário SNMP, coleta) ou o inventário nativo do GLPI para relatórios simples.

## Ponte doc × código
- Padrão comum implementado em [[Modelo de Ativos (padrão comum)]] e [[Composição de um Ativo (componentes)]].
- Processo de negócio: [[Gestão de Ativos e Configuração (SACM)]].
- Coleta automática: [[Inventário automático (processo)]] · [[Fluxo de inventário nativo]] · [[Agente de Inventário (protocolo)]].
- Extensibilidade de tipos: [[Ativos Customizáveis (AssetDefinition)]].
</content>
