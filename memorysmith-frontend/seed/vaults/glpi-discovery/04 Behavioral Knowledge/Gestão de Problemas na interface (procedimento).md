---
title: Gestão de Problemas na interface (procedimento)
aliases: [Manage problems, Gerir problemas]
tags: [problems, problemas, itil, procedimento, ui, assistance]
type: use-case
status: confirmed
source: "[[EV-2-b2-002 · Gestão de problemas — formulário e abas|EV-2-b2-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Gestão de Problemas na interface (procedimento)

Um **problema** (*problem*) é "the cause of potential incidents and, once identified, can be managed in GLPI". Esta nota descreve o uso da tela de problemas — contraparte de documentação da entidade [[Problem]] e do processo [[Gestão de Problemas (processo)]].

## Origem do problema
Pode ser criado de dois lugares:
- do formulário de um **ticket** (aba *Problem*);
- diretamente do menu **Assistance > Problems**.

## Formulário
Muito semelhante ao de criação de ticket, compartilha os conceitos: `Requester`, `Watcher`, `Assigned to`, `Status`, `Urgency`, `Impact`, `Priority`, `Category` (ver [[Ticket]] e [[CommonITILObject (base de service desk)]]). A prioridade deriva de urgência × impacto — ver [[Matriz de prioridade (configuração urgência × impacto)]]. Status e transições seguem a [[Matriz de ciclo de vida (transições de status por perfil)]]. Problemas usam **notificações próprias**.

## Abas
- **Analysis**: análise do problema em 3 blocos — *Impacts*, *Causes*, *Symptoms* — ver [[Aba de Análise (impactos, causas, sintomas, controles)]].
- **Statistics**: semelhantes às de ticket — ver [[Estatísticas do Service Desk (relatórios)]].
- **Tickets**: lista os tickets vinculados; permite adicionar novo ou vincular existente.
- **Changes**: exibe e adiciona mudanças associadas ao problema (ver [[Gestão de Mudanças na interface (procedimento)]]).
- **Costs**: impacto financeiro (humano, material ou fixo).
- **Projects**: anexar/adicionar projetos (ver [[Gestão de Projetos (processo)]]).
- **Tasks**: ação ligada ao problema, geralmente intervenção técnica.
- **Items**: anexa um item ao problema (tipo + item selecionado).
- **Impact analysis**: visualiza o impacto de falhas sobre a infraestrutura.
- **Knowledge Base**, **Notes**, **Historical**, **All**.

> [!warning] Custo em problema fechado/resolvido
> "A cost cannot be added once the problem has been closed or resolved."

> [!question] Solução de contorno em massa
> A documentação registra (em bloco `.. todo::`, com semântica marcada como incerta) que, a partir da lista de tickets, uma solução alternativa/de contorno pode ser associada aos tickets vinculados sem resolver o problema. Ver [[INV-2-b2-003 · Solução de contorno aplicada em massa a tickets de um problema (semântica incerta)]].
