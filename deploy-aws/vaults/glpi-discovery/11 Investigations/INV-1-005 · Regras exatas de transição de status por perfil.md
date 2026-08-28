---
title: INV-1-005 · Regras exatas de transição de status por perfil
aliases: [INV-1-005]
tags: [investigation, consumidor/cad, itil]
type: investigation
maturity: seed
reviewed: false
source: "[[EV-1-008 · CommonITILObject define statuses e matriz de prioridade|EV-1-008]]"
author: CAD Discovery
created: 2026-07-10
---

# INV-1-005 · Regras exatas de transição de status por perfil

> [!question] Pergunta aberta
> Qual é a matriz de transição de status **padrão** (default) de Ticket/Change/Problem, e
> como ela é editada por perfil? Há transições sempre proibidas independentemente do perfil?

`isAllowedStatus()` consulta `glpiactiveprofile[STATUS_MATRIX_FIELD][old][new]` ([[EV-1-008 · CommonITILObject define statuses e matriz de prioridade|EV-1-008]]),
mas o **default** e a UI de edição não foram lidos. Resolver lendo `Profile.php` (aba de
status ITIL) e a instalação padrão (`install/mysql/*`). Impacta diretamente os requisitos de
workflow do cliente.
