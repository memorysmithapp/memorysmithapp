---
title: Usuário alternativo do inventário (alternate username e número)
aliases: [Alternate username, Alternate username number, Usuário alternativo]
tags: [campos-comuns, inventario, usuario, data]
type: field
maturity: evergreen
reviewed: false
source: "[[EV-2-g4-003 · Campos de rede e usuário alternativo do inventário|EV-2-g4-003]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Usuário alternativo do inventário (alternate username e número)

Par de campos comuns ligados à sessão do usuário na máquina inventariada.

- **Alternate username:** retornado pelo [[Fluxo de inventário nativo]], preenchido pelo usuário que abriu a sessão na máquina. Assume a forma `user@machine_name` e é **atualizado** se, no inventário seguinte, outro usuário fizer login.
- **Alternate username number:** número de identificação do usuário, **inserido manualmente** e **nunca** atualizado pelo inventário.

Distingue-se do campo [[Usuário (campo user do ativo)]], que casa o login com a base de usuários do GLPI.
