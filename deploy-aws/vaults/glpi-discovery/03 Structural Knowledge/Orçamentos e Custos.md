---
title: Orçamentos e Custos
aliases: [Budget, Custos, Cost, Orçamento]
tags: [concept, financeiro, dominio/gestao]
type: concept
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-024 · Supplier Contact e Budget|EV-1-024]]"
  - "[[EV-1-023 · Contract com renovação alerta custos e vínculo a itens|EV-1-023]]"
author: CAD Discovery
created: 2026-07-10
---

# Orçamentos e Custos

## Budget (Orçamento)
`Budget` define uma dotação com **valor**, **período de vigência** e entidade. Ativos (via
[[Infocom (dados financeiros do ativo)]]), contratos e custos referenciam `budgets_id`,
permitindo consolidar o gasto por orçamento e acompanhar consumo vs disponível.

## Custos (`*Cost`)
Vários domínios têm sua própria linha de custo, todas `CommonDBChild`:
- `ContractCost` — custos de contrato.
- `TicketCost` / `ChangeCost` / `ProblemCost` — custos de atendimento (mão de obra, material).
- `ProjectCost` — custos de projeto.

Cada custo carrega valor, período, orçamento e, quando aplicável, tempo × valor-hora. É a base
da **Gestão Financeira de TI** (aparece nos relatórios e dashboards de custo).

Ver [[Gestão Financeira de TI]].
