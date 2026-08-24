---
title: Conversão de ativo não gerenciado em outro tipo (fluxo)
aliases: [Converter unmanaged asset, Conversão de ativo]
tags: [assets, unmanaged, conversion, massive-action, flow]
type: flow
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-c1-009 · Ativos não gerenciados e conversão de tipo|EV-2-c1-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Conversão de ativo não gerenciado em outro tipo (fluxo)

Um [[Ativos não gerenciados (unmanaged assets)|ativo não gerenciado]] detectado durante a descoberta de rede pode ser **convertido em outro tipo de objeto** (computador, impressora etc.).

## Caminhos de conversão
1. **Manual** — via **ação em massa específica** do tipo *unmanaged asset*, que permite escolher o tipo de objeto de destino.
2. **Automático/reportado** — via retorno **SNMP, WMI** etc., quando o equipamento passa a fornecer informação.

## Ponte doc × código
- A ação em massa liga-se a E2 [[Ações em massa (massive actions)]] / E1 [[Ações Massivas (bulk actions)]].
- O processo geral de descoberta e incorporação ao parque relaciona-se a [[Fluxo de inventário nativo]] e [[Inventário automático (processo)]].
</content>
