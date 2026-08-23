---
title: Ativos não gerenciados (unmanaged assets)
aliases: [Unmanaged assets, Equipamentos não gerenciados]
tags: [assets, unmanaged, network-discovery, structural]
type: concept
status: confirmed
source: "[[EV-2-c1-009 · Ativos não gerenciados e conversão de tipo|EV-2-c1-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Ativos não gerenciados (unmanaged assets)

Equipamentos **não gerenciados** são aqueles que não são administrados diretamente por um agente GLPI nem por protocolo (SNMP, WMI...). Ao contrário dos gerenciados, **não reportam informação automaticamente** e precisam ser atualizados manualmente no inventário.

Esses dispositivos são **detectados durante uma descoberta de rede (network discovery)** e podem ser **convertidos em outro tipo de objeto** — manualmente ou via retorno SNMP. Ver [[Conversão de ativo não gerenciado em outro tipo (fluxo)]].

Campos e comportamento específicos: possuem `Approved device` (Sim/Não), `Network hub` (Sim/Não), `IP` e credenciais SNMP. Detalhe dos campos em [[Campos do formulário de Ativo não gerenciado]].

## Ponte doc × código
Faz parte do [[Fluxo de inventário nativo]] e da [[Inventário automático (processo)]]; a descoberta de rede/SNMP relaciona-se a [[Agente de Inventário (protocolo)]].
</content>
