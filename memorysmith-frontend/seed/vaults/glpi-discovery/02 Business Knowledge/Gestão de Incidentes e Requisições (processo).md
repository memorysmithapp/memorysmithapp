---
title: Gestão de Incidentes e Requisições (processo)
aliases: [Incident Management, Request Fulfillment, Service Desk]
tags: [process, itil, dominio/service-desk]
type: process
status: confirmed
source:
  - "[[EV-1-010 · Ticket com tipos incidente-requisição e direitos específicos|EV-1-010]]"
  - "[[EV-1-008 · CommonITILObject define statuses e matriz de prioridade|EV-1-008]]"
  - "[[EV-1-012 · Validação ITIL e artefatos filhos followup-task-solution|EV-1-012]]"
author: CAD Discovery
created: 2026-07-10
---

# Gestão de Incidentes e Requisições (processo)

O processo central do service desk, implementado pelo [[Ticket]]. Um mesmo objeto atende
dois processos ITIL, distinguidos pelo **tipo**:
- **Incidente** (`INCIDENT_TYPE`) — restaurar um serviço interrompido/degradado.
- **Requisição de serviço** (`DEMAND_TYPE`) — atender um pedido padrão (acesso, equipamento…),
  frequentemente sujeito a **aprovação** ([[Validação e aprovação (regra)]]).

## Fluxo típico (observado no código)
1. **Abertura** — via interface (helpdesk/central), e-mail (mailcollector), API ou formulário.
   Categoria e template ([[Categorias e templates ITIL]]) determinam campos e responsável padrão.
2. **Classificação** — categoria, tipo, **urgência/impacto → prioridade**
   ([[Priorização (urgência × impacto)]]); SLA/OLA aplicados ([[SLM, SLA e OLA]]).
3. **Atribuição** — a técnico/grupo/fornecedor (papel *assign*, [[Modelo de Atores ITIL]]).
   Status → ASSIGNED/PLANNED.
4. **Atendimento** — followups, tasks e eventual pendência (WAITING + PendingReason).
5. **Solução** — `ITILSolution` registra a solução → status SOLVED.
6. **Fechamento** — CLOSED (manual ou automático após prazo); **pesquisa de satisfação**
   (`TicketSatisfaction`).

Ver a máquina de estados em [[Ciclo de vida de um Ticket (máquina de estados)]] e a timeline
em [[Fluxo de followups, tarefas e solução]].
