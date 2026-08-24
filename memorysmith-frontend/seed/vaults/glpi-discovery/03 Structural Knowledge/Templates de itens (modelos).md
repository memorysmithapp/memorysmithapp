---
title: Templates de itens (modelos)
aliases: [Template, Modelo de objeto, Templates de ativos]
tags: [templates, assets, creation]
type: concept
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-a2-004 · Gestão de templates (ativos e tickets)|EV-2-a2-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Templates de itens (modelos)

Um **template** é um modelo reutilizável de objeto com campos predefinidos que facilita a entrada de dados. Para alguns tipos de objeto, é possível criar novos objetos (computadores, impressoras...) a partir de templates predefinidos. O template define um modelo de criação em que alguns campos são **fixos** ou **calculados por função** (ex.: função que calcula o número de inventário).

O gerenciamento é acessível pelo botão **Templates** na barra de menu.

## Templates de ativos

Para ativos, o template define um objeto padrão com campos pré-preenchidos, reutilizável — simplifica drasticamente adicionar muitos objetos quase idênticos.

> [!example] 20 impressoras idênticas
> Cria-se um template com os campos que não mudam (vendor, model...); as 20 impressoras são criadas a partir dele; na criação, só número de série e número de inventário precisam ser informados.

É possível criar um template retroativamente a partir de um ativo existente, usando a ação **Create template** no menu **Actions** do formulário do ativo.

Alguns campos suportam preenchimento automático e incremento — ver [[Preenchimento automático e incremento em templates]]. Para tickets, o comportamento é distinto — ver [[Templates de tickets]]. Relaciona-se a [[Categorias e templates ITIL]].
