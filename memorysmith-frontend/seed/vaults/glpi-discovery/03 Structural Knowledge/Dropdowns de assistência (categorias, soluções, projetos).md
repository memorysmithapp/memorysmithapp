---
title: Dropdowns de assistência (categorias, soluções, projetos)
aliases: [Ticket categories, Task categories, Solution types, Request sources, Project states]
tags: [dropdown, assistance, ticket-category, solution, project, service-desk]
type: component
status: confirmed
source: "[[EV-2-f2-007 · Dropdowns de assistência categorias soluções projetos|EV-2-f2-007]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Dropdowns de assistência (categorias, soluções, projetos)

Dropdowns usados pelo módulo de Service Desk e por projetos. Categoria de [[Catálogo de tipos de dropdown (configuração)]].

## Categorias de chamado (Ticket categories)
Lista **em árvore**, delegável por entidade. É a visão de configuração de [[Categorias ITIL de chamados]] / [[Categorias e templates ITIL]]. O formulário inclui: grupo responsável/técnico para **atribuição automática**; categoria padrão da base de conhecimento ao adicionar solução; visibilidade conforme interface (simplificada/padrão) ou objeto; **template de ticket** (sobrepõe o da entidade ou de regra de negócio — ver [[Templates de tickets]]); categoria pai; link com categorias da base de conhecimento.

## Categorias de tarefa (Task categories)
Lista **em árvore**, delegável por entidade (nome, categoria pai). Visão de configuração de [[Categorias de tarefa]].

## Tipos de solução, fontes de requisição e templates de solução
- **Solution types**: lista plana, delegável por entidade.
- **Request sources**: lista plana, todas as entidades; define se a fonte é padrão para tickets e/ou collectors.
- **Solution templates**: lista plana, delegável por entidade; predefine conteúdo e tipo de solução; visível ou não da subentidade; **não traduzível**.

## Projetos
- **Project states**: lista plana; status aplicados a um projeto e seu estado.
- **Project types**: lista plana.
- **Project task types**: lista plana.

Relaciona-se a [[Gestão de Projetos (processo)]] e [[Projetos (Project)]].
