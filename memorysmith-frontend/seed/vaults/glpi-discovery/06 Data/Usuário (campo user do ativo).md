---
title: Usuário (campo user do ativo)
aliases: [User, Usuário]
tags: [campos-comuns, atores, usuario, data]
type: field
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-g4-004 · Campos de atores (usuário, grupo, grupo e técnico responsáveis)|EV-2-g4-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Usuário (campo user do ativo)

Campo comum que associa o item ao **usuário** que abriu a sessão na máquina. Se esse usuário existe na base do GLPI (interna ou fonte externa), o campo é preenchido pelo [[Fluxo de inventário nativo]]; caso contrário, permanece vazio.

> [!note] Bloqueio
> Um usuário adicionado manualmente é **bloqueado (locked)** por padrão, para não ser atualizado por inventários posteriores.

Baseia-se no modelo de [[Usuários e Grupos]].
