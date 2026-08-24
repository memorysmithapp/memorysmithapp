---
title: Dispositivo Passivo (ativo)
aliases: [Passive device, Dispositivos passivos]
tags: [assets, passive-device, dcim, structural, doc]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-c2-002 · Dispositivos passivos (passives_devices.rst)|EV-2-c2-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Dispositivo Passivo (ativo)

Tipo de ativo que lista equipamentos que **não processam ativamente dados** mas cumprem papel essencial na infraestrutura de TI, geralmente para conectividade ou transmissão de sinal — por exemplo um **patch panel** ou um **switch não gerenciável**.

Faz parte dos ativos da [[Gestão de Ativos e Configuração (SACM)]].

> [!warning] Sem inventário automático
> "Passive devices cannot be added to the automatic inventory." Devem ser cadastrados manualmente.

## Composição (abas)
- Formulário base ([[Campos do formulário de Dispositivo Passivo]]).
- **Sockets**: portas físicas (Ethernet/USB/HDMI), ligadas a [[Cabo (ativo)]].
- Abas comuns: Management, Contracts, Documents, Tickets, Problems, Changes, Historical.

## Relações
- Suporta [[Templates de itens (modelos)]].
