---
title: Quadro Kanban
aliases: [Kanban, ITIL Kanban, Project Kanban, Task board]
tags: [kanban, board, view, projects, tickets]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-a2-002 · Quadro Kanban|EV-2-a2-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Quadro Kanban

Visão em quadro de tarefas (task board) para exibir [[Projetos (Project)|Projetos]], [[Ticket|Tickets]], [[Change|Mudanças]] ou [[Problem|Problemas]]. As **colunas representam o status** dos itens e cada item é um **cartão** dentro de uma coluna.

## Tipos de Kanban

- **Project Kanban**: pode ser global (todos os projetos e tarefas atuais) ou específico de um projeto e seus filhos. Como os status de projeto são configuráveis, é possível **adicionar novos status direto do Kanban**; há uma coluna especial "No status" sempre visível e imutável.
- **ITIL Kanban** (Tickets, Changes, Problems): apenas global e específico por tipo (não se mistura tickets e changes no mesmo quadro). Os status **não são configuráveis** — só é possível mostrar/ocultar. A coluna "Closed" tem limitação: pode-se arrastar cartões para atualizar o status, mas os itens fechados não são exibidos ali (pelo volume).

## Cartões

Cada cartão mostra: nome do item (título), progresso de subtarefas, se é *milestone* (Project Kanban) e a equipe. Hover no título mostra prévia do conteúdo. O menu "..." oferece **Goto** (formulário completo) e **Delete** (exclui de fato o item). Clicar no título abre um painel *flyout* com o conteúdo em somente-leitura e a equipe completa.

Ver [[Equipes no Kanban (papéis de membros)]] e [[Busca e filtros no Kanban]]. As colunas derivam de [[Status de itens (visão específica)]].
