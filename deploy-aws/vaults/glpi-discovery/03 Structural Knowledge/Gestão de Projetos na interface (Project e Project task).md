---
title: Gestão de Projetos na interface (Project e Project task)
aliases: [Projects UI, Project, Project task, Abas de projeto]
tags: [tools, projects, gantt, kanban, tasks, teams, subproject]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-g3-003 · Gestão de projetos (Project e Project task)|EV-2-g3-003]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Gestão de Projetos na interface (Project e Project task)

A gestão de projetos (**Tools > Projects**) segue todo o progresso de um projeto criando tarefas e equipes. É a visão de usuário do modelo de código [[Projetos (Project)]] e apoia a [[Gestão de Projetos (processo)]]. Baseia-se em dois itens: **project** e **project task**.

> [!note] O que um projeto permite
> Definir tarefas e seguir seu progresso; criar equipes (usuários, grupos, fornecedores, contatos); disparar **subprojetos** (hierarquia via `As child of`); construir diagramas **GANTT** (por projeto e global, via `Show on global GANTT`); usar **Kanban**; anexar **custos**; ligar a itens ITIL (tickets, problems, changes); opcionalmente ligar a uma [[Gestão de Mudanças (processo)|change]].

## Abas de Project
- **Project tasks**: adiciona/lista tarefas.
- **Project team**: membros (contato, fornecedor ou grupo).
- **Project** (subprojetos): exibe e define subprojetos.
- **GANTT**: um por projeto; há GANTT global.
- **Kanban**: método Kanban (ver [[Quadro Kanban]]).
- **Costs**: custos anexáveis; os custos dos tickets ligados às tarefas somam a estes (ver [[Aba Custos (Cost)]]).
- **ITIL objects**: anexa/cria tickets, problems, changes.
- Abas comuns: item, documents, contracts, notes, historical, debug, all.

## Project task
Uma **tarefa** é semelhante a um projeto (pode ser sub-tarefa) e **não é um item independente**: só acessível pela aba `Project tasks` do projeto dono. Tarefas podem ser anexadas a **tickets** para planejar intervenções; durações planejada/real são reportadas ao nível do projeto junto à duração dos tickets. Abas: Project tasks, Task team, documents, tickets, notes, historical, all.

Campos detalhados em [[Campos de um Projeto e de uma Tarefa de Projeto]].

## Ver também
- [[Projetos (Project)]] · [[Gestão de Projetos (processo)]] · [[Quadro Kanban]] · [[Aba Projetos (vincular projeto a um objeto)]]
