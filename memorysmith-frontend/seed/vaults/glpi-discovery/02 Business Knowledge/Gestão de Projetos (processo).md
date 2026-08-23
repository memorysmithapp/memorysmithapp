---
title: Gestão de Projetos (processo)
aliases: [Project Management]
tags: [process, projeto, dominio/gestao]
type: process
status: confirmed
source: "[[EV-1-026 · Project ProjectTask ProjectTeam e ProjectCost|EV-1-026]]"
author: CAD Discovery
created: 2026-07-10
---

# Gestão de Projetos (processo)

Processo para planejar e acompanhar iniciativas de TI, apoiado por [[Projetos (Project)]].

## Fluxo
1. **Abertura** — projeto com objetivo, gestor, datas planejadas, orçamento.
2. **Planejamento** — decomposição em `ProjectTask` (subtarefas, dependências, esforço),
   definição de **milestones** e **equipe** (`ProjectTeam`).
3. **Execução** — atualização de progresso; **% concluído** do projeto é **rolado** a partir
   das tarefas; visões **Kanban** e **Gantt**; agenda via CalDAV.
4. **Custos** — `ProjectCost` alimenta a [[Gestão Financeira de TI]].
5. **Encerramento** — mudança de estado (`ProjectState`).

Conecta-se a [[Gestão de Mudanças (processo)|mudanças]] (um projeto pode orquestrar várias
Changes) e à agenda corporativa.
