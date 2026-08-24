---
title: Categorias e templates ITIL
aliases: [ITILCategory, ITILTemplate, TicketTemplate]
tags: [component, template, categoria, dominio/service-desk]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-1-014 · Categorias e templates ITIL|EV-1-014]]"
author: CAD Discovery
created: 2026-07-10
---

# Categorias e templates ITIL

## Categorias (`ITILCategory`)
Árvore ([[CommonTreeDropdown (dropdowns em árvore)]]) que classifica chamados. Uma categoria
pode definir **grupo/técnico responsável padrão**, **template** associado e visibilidade por
tipo (incidente / requisição / mudança / problema). É base para roteamento e relatórios.

## Templates (`ITILTemplate` → TicketTemplate/ChangeTemplate/ProblemTemplate)
Modelam o **formulário** de abertura/edição. Para cada template, sub-tabelas definem o
comportamento de cada campo:
- **Mandatory** — campo obrigatório.
- **Hidden** — campo oculto.
- **Predefined** — valor pré-preenchido.
- **Readonly** — somente leitura.

Isso permite, por exemplo, um template "Reset de senha" com categoria fixa, urgência
pré-definida e descrição obrigatória — sem código.

> [!note] Para requisitos
> Grande parte da customização de service desk do cliente vive em **categorias + templates**
> (dados de configuração), não em código. Um levantamento de requisitos deve inventariar
> esses registros na instância-alvo.
