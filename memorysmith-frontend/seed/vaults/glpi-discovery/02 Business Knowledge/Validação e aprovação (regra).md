---
title: Validação e aprovação (regra)
aliases: [Validação, Aprovação, ITILValidation]
tags: [rule, itil, aprovacao, dominio/service-desk]
type: rule
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-1-012 · Validação ITIL e artefatos filhos followup-task-solution|EV-1-012]]"
author: CAD Discovery
created: 2026-07-10
---

# Validação e aprovação (regra)

> [!note] Regra
> Um chamado ou mudança pode exigir **aprovação** antes de prosseguir. O pedido de validação
> (`CommonITILValidation` → `TicketValidation`/`ChangeValidation`) tem estados
> **NONE(1) → WAITING(2) → ACCEPTED(3) | REFUSED(4)**.

- A validação pode ser dirigida a um **usuário**, um **grupo** ou por **substituição**
  (delegação). O status global de validação do objeto agrega os pedidos.
- Requisições (`DEMAND_TYPE`) tipicamente passam por validação; o direito `ticketvalidation`
  ([[Perfis e Direitos (RBAC)]]) controla quem pode validar.
- Em mudanças, a aprovação (fase APPROVAL) é o gate do CAB antes da execução —
  ver [[Gestão de Mudanças (processo)]].
