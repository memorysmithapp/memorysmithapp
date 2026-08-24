---
title: Ativos Customizáveis (AssetDefinition)
aliases: [AssetDefinition, ativos customizados, custom assets, capacities]
tags: [component, custom-assets, dominio/ativos]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-1-022 · Ativos customizáveis AssetDefinition com capacities e custom fields|EV-1-022]]"
author: CAD Discovery
created: 2026-07-10
---

# Ativos Customizáveis (AssetDefinition)

Recurso do GLPI 11 que permite **criar novos tipos de ativo pela interface**, sem plugin nem
código. Uma **AssetDefinition** (extensão de `CustomObject\AbstractDefinition`) gera uma classe
de ativo (`Glpi\Asset\Asset`) que se comporta como os ativos nativos.

## Dois mecanismos de composição
- **Capacities** (`Glpi\Asset\Capacity\*`) — recursos ativáveis por definição: ser
  inventariável, ter portas de rede, Infocom, documentos, contratos, histórico, notas,
  reserva, etc. Cada capacity "empresta" um comportamento do core ao ativo customizado.
- **Custom fields** (`Glpi\Asset\CustomFieldType\*`) — campos personalizados (string, texto,
  dropdown, raw) definidos por configuração.

## Implicação para requisitos
Parte do modelo de dados do cliente pode viver em **definições de ativo** (dados de
configuração), não em código. Um levantamento deve inventariar as AssetDefinitions e suas
capacities na instância-alvo. Capacidades exatas a catalogar em
[[INV-1-006 · Capacities disponíveis para ativos customizados]].
