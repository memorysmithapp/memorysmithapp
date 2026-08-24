---
title: Campos do formulário de Computador
aliases: [Campos de Computador]
tags: [assets, data, computer, form]
type: entity
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-c1-003 · Formulário e abas de Computador|EV-2-c1-003]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos do formulário de Computador

Aba **Computer** (`Assets > Computers`), campos básicos: Name, [[Campos comuns de um ativo (formulário)|Location, Technician/Group in charge, Alternate username(+number), User, Group, Comments, Status]], Computer type, Manufacturer, Model, Serial number, Inventory number, Network, UUID, Update source.

## Campos de agente (se inventariado pelo GLPI Agent)
Agents · Public contact address · Agents Status · Useragent · Last contact · Request inventory · Inventory tag · Last inventory update.

> [!note] O computador não expõe `Management type` — é sempre de gestão unitária.

## Abas específicas relevantes
Além das [[Abas comuns de um ativo (visão do usuário)|abas comuns]]: **Virtualization** (VMs; criar computador por VM ou referenciar), **Antiviruses** (Windows: detectado no Security Center), **Databases**, **Certificates**, **Remote management**, **Volumes**, **Components**.

## Ponte doc × código
Complementa a nota de código [[Composição de um Ativo (componentes)]] e [[Modelo de Ativos (padrão comum)]].
</content>
