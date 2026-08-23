---
title: Gestão unitária vs global de ativos (visão do doc)
aliases: [Management type, Tipo de gestão do ativo]
tags: [assets, management-type, structural]
type: concept
status: confirmed
source: "[[EV-2-c1-004 · Formulário de Monitor e gestão unitária vs global|EV-2-c1-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Gestão unitária vs global de ativos (visão do doc)

Alguns tipos de ativo periféricos ao computador (monitor, periférico, telefone, impressora) expõem o campo **Management type**, que define se o item é gerido de forma **unitária** ou **global**:

- **Unitária** — um item por computador (ex.: um display por máquina).
- **Global** — o item vira um elemento virtual global conectado a vários computadores.

> [!quote] Racional
> "Global management allows to limit the number of elements to manage when these elements are not a strategic data in the assets management."

O **computador** não expõe esse campo (é sempre gerido unitariamente); o **SIM** também não.

## Ponte doc × código
Aprofunda a nota de código [[Gestão global vs unitária de itens]] (E1) com a semântica de produto do campo `Management type` nos formulários de ativo.
</content>
