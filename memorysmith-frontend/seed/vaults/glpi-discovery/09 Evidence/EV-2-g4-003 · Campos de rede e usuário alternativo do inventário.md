---
title: EV-2-g4-003 · Campos de rede e usuário alternativo do inventário
aliases: [EV-2-g4-003]
tags: [evidence, campos-comuns, rede, inventario, usuario]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · tabs/common_fields/network.rst · Network; tabs/common_fields/alternate_user.rst · Alternate username; tabs/common_fields/alternate_username.rst · Alternate username number"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-g4-003 · Rede e usuário alternativo

> [!quote] Network (`network.rst`)
> "Network is information added manually. you can pre-fill this information using a template." É um dropdown; criação via **+** → Nome → Comentário (opcional) → **+ Add**. Trata-se de um rótulo de rede associado ao ativo (não confundir com a modelagem de portas/IP/VLAN).

> [!quote] Alternate username (`alternate_user.rst`)
> "The alternate username is a field returned by the inventory. It is filled in by the user who opened the session on the machine concerned. This field can be updated if, during the next inventory, another user logs on to the machine. It takes the form ``user@machine_name``." Preenchido automaticamente pelo inventário.

> [!quote] Alternate username number (`alternate_username.rst`)
> "In this field, you can manually enter a user identification number. This field is not updated by the inventory." Número de identificação do usuário alternativo — inserção manual, nunca sobrescrito pelo inventário.

## Sustenta
- [[Rede (campo de ativo)]]
- [[Usuário alternativo do inventário (alternate username e número)]]
