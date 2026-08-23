---
title: EV-2-b2-005 · Matriz de cálculo de prioridade (urgência × impacto)
aliases: [EV-2-b2-005]
tags: [evidence, priority, prioridade, urgencia, impacto, matriz, itil]
type: evidence
status: confirmed
source: "SRC-002 · modules/assistance/prioritymatrix.rst · Matrix of calculus for priority (documento inteiro)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-b2-005 · Matriz de cálculo de prioridade (urgência × impacto)

> [!quote] Matriz comum a todos os itens do help desk
> "This matrix is common to all help desk items (tickets, problems and changes) and can be parameterized in tab `Assistance` of menu **Setup > General**." (prioritymatrix.rst)

> [!quote] Fundamento ITIL
> "ITIL best practices separate urgency (as defined by the user) from incident impact (a user, a service, a functionality...) which is usually set by the technician. A matrix is then used to compute the priority associated to the item of the help desk (ticket, problem or change) as a function of both urgency and impact. GLPI provides a default predefined matrix which corresponds to standard cases." (prioritymatrix.rst)

> [!quote] Configuração e desativação de níveis
> "Knowing that the order of items processing by technicians is based on priority, it is possible to select the different levels of urgency, impact or priorities that will be used in the help desk and to disable some of them. (...) To disable a level, this level must be set to `No`. Medium level cannot be disabled." No exemplo do doc, a urgência `Low` não é proposta ao solicitante e o impacto `High` não é proposto ao técnico. (prioritymatrix.rst; matriz ilustrada em `images/priority_matrix.png`)

> [!quote] Prioridade Major fora da matriz
> "The **Major** priority used by tickets is not part of the matrix. This level is higher than any other and requires the permission to modify priority in order to be able to assign it. A **Major** incident is a ticket whose processing is of such high importance that it overrides any other ticket." (prioritymatrix.rst)

> [!note] Valores numéricos da matriz default
> Os valores exatos da matriz predefinida (5 níveis de urgência × 5 de impacto → prioridade) aparecem apenas na captura de tela `images/priority_matrix.png`, não em texto. Ver [[INV-2-b2-002 · Valores exatos da matriz de prioridade default]].

## Sustenta
- [[Matriz de prioridade (configuração urgência × impacto)]]
