---
title: Campos do formulário de Ativo não gerenciado
aliases: [Campos de Unmanaged asset]
tags: [assets, data, unmanaged, form]
type: entity
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-c1-009 · Ativos não gerenciados e conversão de tipo|EV-2-c1-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos do formulário de Ativo não gerenciado

Formulário do [[Ativos não gerenciados (unmanaged assets)|ativo não gerenciado]] (detectado por descoberta de rede). Campos:

Name; [[Campos comuns de um ativo (formulário)|Location]]; Manufacturer; Serial number; Inventory number; **SNMP Credentials**; Network; Update source; **Approved device: Yes/No**; Status; Technician in charge; Alternate username number; Alternate username; **Sysdescr**; User; Comments; **IP**; **Network hub: Yes/No**.

- Campos próprios: **Approved device** (aprovação do dispositivo), **IP**, **Network hub**, **Sysdescr**, **SNMP Credentials**.
- **Abas:** Network Ports, Domains, Locks, Import information, Historical, All.

> [!note] Ausência de campos de hardware detalhado (Model, UUID, Components) até que o item seja convertido em outro tipo — ver [[Conversão de ativo não gerenciado em outro tipo (fluxo)]].
</content>
