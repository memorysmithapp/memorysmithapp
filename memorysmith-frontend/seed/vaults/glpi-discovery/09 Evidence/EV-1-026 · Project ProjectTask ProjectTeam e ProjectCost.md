---
title: EV-1-026 · Project, ProjectTask, ProjectTeam e ProjectCost
aliases: [EV-1-026]
tags: [evidence, dominio/gestao, projeto]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-001 · src/Project.php L50, 266–329 · src/ProjectTask.php L59 · src/ProjectTeam.php L48 · src/ProjectCost.php L40"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-026 · Project, ProjectTask, ProjectTeam e ProjectCost

> [!quote] classes (grep confirmado)
> ```php
> class Project extends CommonDBTM implements ExtraVisibilityCriteria, KanbanInterface, TeamworkInterface { ... }
> class ProjectTask extends CommonDBChild implements CalDAVCompatibleItemInterface, TeamworkInterface { ... }
> class ProjectTeam extends CommonDBRelation { ... }
> class ProjectCost extends CommonDBChild { ... }
> // Project::percent_done é recalculado (rollup) a partir das tarefas (L266–329)
> ```

Gestão de projetos:
- **Project** — projeto com estado (`ProjectState`), datas, **% concluído** (recalculado
  automaticamente a partir das tarefas quando `auto_percent_done`), Kanban e milestones.
- **ProjectTask** — tarefas hierárquicas (subtarefas), com esforço planejado/efetivo,
  dependências e compatibilidade **CalDAV** (agenda).
- **ProjectTeam** — equipe do projeto (usuários/grupos/fornecedores/contatos).
- **ProjectCost** — custos do projeto.

Integra-se a chamados/mudanças (um projeto pode agrupar Changes) e à agenda (Planning).

## Sustenta
- [[Projetos (Project)]]
- [[Gestão de Projetos (processo)]]
