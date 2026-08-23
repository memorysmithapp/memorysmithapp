---
title: INV-2-c3-001 · Escopo dos campos passíveis de bloqueio (locks)
aliases: [INV-2-c3-001]
tags: [investigation, consumidor/cad, assets, locks, inventory]
type: investigation
status: open
author: CAD Discovery (doc)
created: 2026-07-12
---

## Dúvida
A documentação da [[Aba Bloqueios (locks de inventário)]] descreve o **comportamento** dos locks (ativados por edição manual, exibidos como cadeado, removíveis por ação em massa), mas **não enumera quais campos** de quais tipos de item podem ser bloqueados, nem se todos os campos de inventário são "lockáveis" ou apenas um subconjunto.

## O que motivou
`modules/assets/tabs/locks.rst` afirma que "Locks prevent certain information from being modified during automatic inventory feedback" — o "certain information" não é qualificado.

## A investigar
- Lista concreta de campos/relacionamentos passíveis de lock por tipo de ativo (Computer, Monitor, NetworkEquipment, etc.).
- Se o lock cobre também objetos relacionados (portas de rede, volumes, software, antivírus) e não só campos escalares.
- Como o lock é persistido/modelado no código (tabela/entidade correspondente) — cruzar com [[Fluxo de inventário nativo]] e [[Rede (portas, IP, VLAN)]].

## Próximo passo
Confirmar contra o código-fonte (SRC-001) a entidade de lock e o conjunto de campos elegíveis.
