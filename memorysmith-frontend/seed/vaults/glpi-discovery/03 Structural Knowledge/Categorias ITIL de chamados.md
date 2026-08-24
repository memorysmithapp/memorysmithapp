---
title: Categorias ITIL de chamados
aliases: [ITIL Categories, Categorias de ticket]
tags: [assistance, categories, itil, hierarchy, template, dropdown]
type: concept
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-b1-011 · Categorias ITIL e de tarefa|EV-2-b1-011]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Categorias ITIL de chamados

As **categorias ITIL** classificam chamados por natureza e são compartilhadas por **Tickets, Changes e Problems**. São gerenciadas como [[Dropdown (lista suspensa customizável)|dropdown]] em *Setup > Dropdowns > Ticket Categories*.

## Características
- **Hierárquicas**: via campo `As child of` (categoria pai) ou aba `ITIL Categories` (filha).
- **Responsáveis para notificação**: uma pessoa encarregada e/ou um grupo técnico podem ser vinculados à categoria e usados nas notificações.
- **Base de conhecimento**: uma categoria da KB pode ser associada; ao salvar a solução do ticket na KB, essa categoria vira o padrão do novo artigo.
- **Visibilidade**: pode ser invisível na interface simplificada (reduz a lista para usuários finais) e visível ou não por tipo (incident, demand, problem, change).
- **Template**: um [[Templates de tickets|template]] pode ser associado e carregado ao selecionar a categoria, podendo diferir entre demands e incidents.

> [!hint] Boas práticas de helpdesk
> Escolher com cuidado a lista de categorias visíveis: excesso dificulta a criação; escassez impede qualificar bem a demanda. Categorias também permitem processamento automático na criação (via regras de negócio).

## Ver também (código)
- [[Categorias e templates ITIL]] · [[Priorização (urgência × impacto)]]
- [[Categorias de tarefa]]
