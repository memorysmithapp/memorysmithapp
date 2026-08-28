---
title: Templates de tickets
aliases: [Ticket template, Modelo de ticket]
tags: [templates, tickets, mandatory-fields, itil]
type: concept
maturity: evergreen
reviewed: false
source: "[[EV-2-a2-004 · Gestão de templates (ativos e tickets)|EV-2-a2-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Templates de tickets

Templates de tickets customizam a **interface de criação** de tickets conforme o **tipo** e a **categoria** do ticket. Diferem dos [[Templates de itens (modelos)|templates de ativos]] por atuarem no comportamento do formulário, não só em valores pré-preenchidos.

## Comportamentos configuráveis

- campos **obrigatórios** para criar o ticket;
- campos com **valor predefinido**;
- campos **mascarados** (ocultos).

> [!note] Controle de obrigatoriedade
> Só são controlados quanto à obrigatoriedade os campos visíveis na interface do usuário. Um campo obrigatório mas invisível não dispara erro.

## Escopo e padrões

Um template é anexado à entidade onde foi criado e pode ser visível em subentidades (ver [[Recursividade em entidades]]). Templates padrão podem ser definidos por **entidade**, por **perfil** (só templates da entidade raiz visíveis de subentidades) ou por **categoria de ticket** (ver [[Categorias e templates ITIL]]).

## Ordem de prioridade na criação

1. Template definido na **categoria e tipo** selecionados;
2. Template padrão do **perfil** atual do usuário;
3. Template padrão da **entidade de criação** do ticket.

> [!warning] Reavaliação
> Nos casos 2 e 3, se o template definir novo par tipo/categoria, o caso 1 é testado novamente com esses novos valores. Se entidade, perfil, tipo ou categoria mudam durante o preenchimento, o template é rebuscado. A mesma ordem determina os campos obrigatórios na atualização.

O template é usado também para criar tickets recorrentes. Relaciona-se a [[Ticket]] e [[Gestão de Incidentes e Requisições (processo)]].
