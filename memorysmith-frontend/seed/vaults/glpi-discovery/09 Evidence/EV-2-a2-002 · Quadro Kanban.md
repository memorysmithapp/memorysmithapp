---
title: EV-2-a2-002 · Quadro Kanban
aliases: [EV-2-a2-002]
tags: [evidence, kanban, board, team, filter]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/overview/kanban.rst · Kanban (Cards, Team management, Searching and Filtering)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-a2-002 · Quadro Kanban

> [!quote] O que é o Kanban
> "The Kanban is a view to display Projects, Tickets, Changes or Problems on a task board." Para Projetos, há um Kanban global (todos os projetos e tarefas atuais) ou um Kanban de um projeto específico e seus filhos. Para Tickets, Changes e Problems só há Kanban global, específico por tipo (não se mistura tickets e changes no mesmo Kanban) — referido como *ITIL Kanban*. — `kanban.rst`, introdução.

> [!quote] Colunas = status
> "Currently, the columns of the Kanban represent the status of the items. Each item is represented by a card inside the columns." Para Projetos, é possível adicionar novos status direto do Kanban (são configuráveis) e há coluna especial "No status" sempre visível e imutável. Para o ITIL Kanban só se pode mostrar/ocultar status (não são configuráveis); a coluna "Closed" tem limitação: pode-se arrastar cards para atualizar status, mas eles não são exibidos ali (devido ao número de itens). — `kanban.rst`.

> [!quote] Cartões (cards)
> Cada card mostra: nome do item (título), progresso de subtarefas (tarefas/projetos filhos, ou tickets filhos), se o item é um milestone (Project Kanban), e a equipe. Hover no título mostra prévia do conteúdo/descrição. O menu "..." tem **Goto** (vai ao formulário completo) e **Delete** (exclui de fato o item). Clicar no título abre um painel flyout com visão somente-leitura do conteúdo e lista completa da equipe, permitindo adicionar/remover membros sem ir ao formulário. — `kanban.rst`, "Cards".

> [!quote] Gestão de equipe (Team management)
> Há múltiplas noções de "Team": para Tickets/Changes/Problems há requesters, observers e assignees; para Projetos e tarefas de projeto há uma "team" simples (aba team) mais managers (formulário principal). O Kanban apresenta tudo como uma "Team" única com papéis, em lista centralizada. Ao adicionar membro, escolhe-se papel, depois o tipo (user, group, etc.) e o membro específico. Nota: o Kanban não permite alterar managers a partir do Project Kanban. — `kanban.rst`, "Team management".

> [!quote] Busca e filtros
> Busca por termos digitados. Ao clicar na caixa, um tooltip sugere *tags* de filtro (variam por Kanban; plugins podem adicionar). Tags: `title`, `type`, `content`, `team`. Modificadores comuns: `!` (negação/exclusão), `#` (expressão regular). Filtros manuais como `title:this` ou `!title:notthis`. Cada filtro tem fundo colorido por tipo: exclusões vermelho, regex verde, tags regulares azul, buscas sem tag preto. Enter (ou clicar fora) inicia a busca. — `kanban.rst`, "Searching and Filtering".

## Sustenta
- [[Quadro Kanban]]
- [[Equipes no Kanban (papéis de membros)]]
- [[Busca e filtros no Kanban]]
