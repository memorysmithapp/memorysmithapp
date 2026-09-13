---
title: EV-2-b2-002 · Gestão de problemas — formulário e abas
aliases: [EV-2-b2-002]
tags: [evidence, problems, problemas, itil, assistance]
type: evidence
maturity: evergreen
reviewed: false
source:
  - "SRC-002 · modules/assistance/problems.rst · Manage problems (documento inteiro)"
  - "SRC-002 · modules/assistance/tabs/analysis.rst · Analysis"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-b2-002 · Gestão de problemas — formulário e abas

> [!quote] Definição e origem
> "A problem is the cause of potential incidents and, once identified, can be managed in GLPI. Creating a problem object can be done either from the ticket form, in tab *Problem*, or directly from menu *Assistance > Problems*." (problems.rst)

> [!quote] Formulário compartilha conceitos com o ticket
> "The problem creation form is very similar to the ticket creation form and shares with it many concepts: `Requester`, `Watcher`, `Assigned to`, `Status`, `Urgency`, `Impact`, `Priority`, `Category`." Problemas usam suas próprias notificações. "Statistics similar to tickets are available for problems." (problems.rst)

> [!quote] Aba Analysis (problema)
> "This tab contains problem analysis. It consists of 3 inserts: Impacts / Causes / Symptoms." (problems.rst e tabs/analysis.rst; imagem `analysis-view.png`)

> [!quote] Demais abas do problema
> - **Statistics**: semelhantes às de tickets (imagem `problems-statistics.png`).
> - **Tickets**: lista todos os tickets vinculados ao problema; pode adicionar novo ticket ou vincular existente.
> - **Changes**: exibe mudanças associadas ao problema e permite adicionar novas.
> - **Costs**: custo = impacto financeiro do problema (humano, material ou fixo). Aviso: "A cost cannot be added once the problem has been closed or resolved."
> - **Projects**: anexar/adicionar um ou mais projetos ao problema.
> - **Tasks**: "A task is an action linked with a problem, usually a technical intervention."
> - **Items**: anexar um item ao problema escolhendo tipo e item.
> - **Impact analysis**: "visualise the impact of failures on an entire infrastructure" (remete a `tabs/impact_analysis`).
> - **Knowledge Base**, **Notes**, **Historical**, **All** (incluídas). (problems.rst)

> [!warning] TODO no próprio doc (ambiguidade de origem)
> O arquivo contém um bloco `.. todo:: Check what is means` sobre: "From tickets list, an alternative solution can be associated to linked tickets without solving the problem." (solução de contorno aplicada a tickets vinculados sem resolver o problema). Semântica marcada como incerta na própria documentação. Ver [[INV-2-b2-003 · Solução de contorno aplicada em massa a tickets de um problema (semântica incerta)]].

## Sustenta
- [[Gestão de Problemas na interface (procedimento)]]
- [[Aba de Análise (impactos, causas, sintomas, controles)]]
- [[Estatísticas do Service Desk (relatórios)]]
- [[Vínculos entre objetos ITIL (tipos de ligação)]]
