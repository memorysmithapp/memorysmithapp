---
title: EV-2-g3-003 · Gestão de projetos (Project e Project task)
aliases: [EV-2-g3-003]
tags: [evidence, tools, projects, gantt, kanban, tasks, teams]
type: evidence
status: confirmed
source: "SRC-002 · source/modules/tools/projects.rst · Manage projects"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-g3-003 · Gestão de projetos (Project e Project task)

> [!quote] source/modules/tools/projects.rst — "Manage projects"
> Gestão de projetos permite seguir todo o progresso criando tarefas e formando equipes; projetos podem ser opcionalmente ligados a uma **change**.
> Um projeto GLPI permite: definir tarefas e seguir seu progresso; criar equipes para projeto e tarefas; disparar **subprojetos**; construir diagramas **GANTT**; usar método **Kanban**; anexar **custos**; ligar a itens ITIL do GLPI.
> Projeto pode ser **hierárquico** (ter subprojetos).
> Caracterizado por: **name, code, state, type, datas provisórias e reais, percent done**.
> Equipes de gestão distintas: usuários, grupos, fornecedores e contatos.
> Vários diagramas GANTT por projeto (aba GANTT). Baseia-se em dois tipos de item: **project** e **project task**.

> [!quote] Abas de Project
> **Project tasks**: adiciona/lista tarefas (nome, tipo, status, datas planejadas/reais, percent done, tarefa pai).
> **Project team**: adiciona membros (contato, fornecedor ou grupo); lista tipo de cada membro.
> **Project** (subprojetos): exibe subprojetos; subprojeto = projeto com campo `As child of` definido.
> **GANTT**: diagrama por projeto; GANTT global inclui projetos com `Show on global GANTT`.
> **Kanban**: interface do método Kanban.
> **Costs**: custos anexáveis; custos dos tickets ligados às tarefas somam a estes custos.
> **ITIL objects**: anexa tickets, problems e changes (podem ser criados direto desta aba).
> Abas comuns incluídas: item, documents, contracts, notes, historical, debug, all.

> [!quote] Project task
> Tarefa é semelhante a um projeto; pode ser sub-tarefa de projeto. Caracterizada por name, state, type, datas provisórias/reais, percent done; equipes de usuários/grupos/fornecedores/contatos.
> "A project task is not an independent item, it can only be accessed through the `Project tasks` tab of the project owning the task."
> Tarefas podem ser anexadas a tickets para planejar intervenções. Duração planejada e real são definidas e reportadas ao nível do projeto junto à duração dos tickets anexados.
> Abas da tarefa: Project tasks (sub-tarefas), Task team, documents, tickets, notes, historical, all.

## Sustenta
- [[Gestão de Projetos na interface (Project e Project task)]]
- [[Campos de um Projeto e de uma Tarefa de Projeto]]
