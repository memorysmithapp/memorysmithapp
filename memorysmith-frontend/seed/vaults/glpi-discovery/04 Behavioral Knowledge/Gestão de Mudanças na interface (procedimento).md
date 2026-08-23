---
title: Gestão de Mudanças na interface (procedimento)
aliases: [Manage changes, Gerir mudanças]
tags: [changes, mudancas, itil, procedimento, ui, assistance]
type: use-case
status: confirmed
source: "[[EV-2-b2-001 · Gestão de mudanças — formulário, abas e fluxo|EV-2-b2-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Gestão de Mudanças na interface (procedimento)

Do ponto de vista do usuário/administrador, uma **mudança** (*change*) é "a modification of the information system's infrastructure". Esta nota descreve como criar, preencher, excluir e acompanhar uma mudança pela interface — a contraparte de documentação da entidade [[Change]] e do processo [[Gestão de Mudanças (processo)]].

## Origem da mudança
Uma mudança pode nascer de três lugares:
- do formulário de um **ticket** (aba *Changes*);
- do formulário de um **problema** (aba *Changes*);
- do menu **Assistance > Changes** (botão **+ Add**).

## Formulário
O formulário é semelhante ao de criação de ticket e compartilha muitos campos: *requester*, *watcher*, *assigned to*, *status*, *urgency*, *impact*, *priority*, *category* (ver [[Ticket]] e [[CommonITILObject (base de service desk)]]). O processo de **validação** é o mesmo dos tickets (aba *Validations*), permitindo validação preliminar da mudança. Ver [[Validação e aprovação (regra)]].

A prioridade é calculada por urgência × impacto — ver [[Matriz de prioridade (configuração urgência × impacto)]] e [[Priorização (urgência × impacto)]]. Os status disponíveis e as transições permitidas seguem a [[Matriz de ciclo de vida (transições de status por perfil)]].

## Fases e abas próprias
- **Analysis**: descreve *Impacts* e uma *Control list* — ver [[Aba de Análise (impactos, causas, sintomas, controles)]].
- **Plans**: *Deployment plan* + *Backup plan* + *Checklist* para implementar a mudança.
- **Items**: itens de configuração impactados (via `tabs/item.rst`).
- **Impact Analysis**: diagramas da infraestrutura para visualizar o impacto da mudança.
- **Statistics**: indicadores de tempo (tomada de posse, fechamento etc.), semelhantes aos de ticket — ver [[Estatísticas do Service Desk (relatórios)]].
- **Approvals**: solicita validação a grupos e/ou usuários.
- **Problems** e **Tickets**: vinculam objetos existentes — ver [[Vínculos entre objetos ITIL (tipos de ligação)]].
- Abas comuns incluídas: **Costs**, **Projects**, **Knowledge Base**, **Notes**, **Historical**, **All**.

Como nos tickets, *task*, *costs* e *solution* permitem acompanhar e resolver a mudança. Para mudanças complexas, uma mudança pode ser ligada a um ou mais **projetos** (ver [[Gestão de Projetos (processo)]]). As mudanças usam **notificações próprias**.

## Ciclo de exclusão
- **Excluir**: abrir a mudança → *put in trashbin* (rodapé) → vai para a [[Lixeira e purga (trash bin)]].
- **Restaurar/purgar**: pela lixeira (topo direito) → **Actions** → **Restore** ou **Delete permanently** → **Post**.

> [!warning] **Delete permanently** remove a mudança definitivamente, sem possibilidade de recuperação.

> [!note] Status
> Segundo o doc, há vários status, "including some for test phases, validation, qualification, etc.". O conjunto exato aparece nas capturas de tela `changes-status-1/2.png`. Ver [[Status de itens (visão específica)]].
