---
title: Projetos (Project)
aliases: [Project, Projeto, ProjectTask]
tags: [entity, projeto, dominio/gestao]
type: entity
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-1-026 · Project ProjectTask ProjectTeam e ProjectCost|EV-1-026]]"
author: CAD Discovery
created: 2026-07-10
---

# Projetos (Project)

Gestão de projetos para organizar iniciativas de TI (implantações, migrações), muitas vezes
associada a mudanças.

- **Project** — estado (`ProjectState`), datas planejadas/reais, **% concluído** recalculado
  (rollup) das tarefas, prioridade, gestor, **milestones**; visões **Kanban** e **Gantt**.
- **ProjectTask** — tarefas hierárquicas (subtarefas), esforço planejado/efetivo, dependências,
  e compatibilidade **CalDAV** (integra à agenda/Planning).
- **ProjectTeam** — equipe (usuários/grupos/fornecedores/contatos).
- **ProjectCost** — custos ([[Orçamentos e Custos]]).

Conecta-se a [[Change|mudanças]] e chamados, e ao módulo de agenda. Processo em
[[Gestão de Projetos (processo)]].
