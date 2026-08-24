---
title: Gestão de Mudanças (processo)
aliases: [Change Management]
tags: [process, itil, dominio/service-desk]
type: process
maturity: evergreen
reviewed: false
source: "[[EV-1-013 · Change e Problem estendem CommonITILObject com fases próprias|EV-1-013]]"
author: CAD Discovery
created: 2026-07-10
---

# Gestão de Mudanças (processo)

Processo ITIL implementado pela entidade [[Change]] para planejar, aprovar e implementar
mudanças de forma controlada.

## Fases (statuses próprios da Change)
1. **Registro/Avaliação** (EVALUATION) — descrição, análise de impacto/risco, rollback.
2. **Aprovação** (APPROVAL) — aprovação por CAB/gestor via `ChangeValidation`
   ([[Validação e aprovação (regra)]]).
3. **Planejamento/Execução** (PLANNED → em andamento) — tarefas (`ChangeTask`) e agenda.
4. **Teste** (TEST) e **Qualificação** (QUALIFICATION) — verificação do resultado.
5. **Encerramento** — CLOSED, ou **REFUSED/CANCELED** se rejeitada/cancelada.

Integra-se à análise de impacto ([[Impact Analysis]]) e conecta-se a incidentes/problemas de
origem (`Change_Ticket`, `Change_Problem`) — a cadeia **incidente → problema → mudança**.

> [!note]
> Assim como o Ticket, as transições permitidas são governadas pela matriz de status
> **por perfil** (`change_status`), e o formulário pelo `ChangeTemplate`.
