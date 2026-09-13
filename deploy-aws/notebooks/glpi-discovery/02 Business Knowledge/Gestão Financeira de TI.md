---
title: Gestão Financeira de TI
aliases: [Financial Management, ITFM, custos]
tags: [process, financeiro, dominio/gestao]
type: process
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-020 · Infocom dados administrativos e financeiros do ativo|EV-1-020]]"
  - "[[EV-1-023 · Contract com renovação alerta custos e vínculo a itens|EV-1-023]]"
  - "[[EV-1-024 · Supplier Contact e Budget|EV-1-024]]"
author: CAD Discovery
created: 2026-07-10
---

# Gestão Financeira de TI

Processo que dá visibilidade sobre o custo do parque de TI, ancorado em três fontes de dados:

- **Infocom** ([[Infocom (dados financeiros do ativo)]]) — compra, garantia e **depreciação**
  por ativo.
- **Contratos e seus custos** ([[Contratos (Contract)]], `ContractCost`).
- **Custos de atendimento e projeto** (`TicketCost`, `ChangeCost`, `ProjectCost` —
  ver [[Orçamentos e Custos]]).

Tudo consolidável por **orçamento** (`Budget`), **centro de custo**, entidade e período.

## Capacidades
- Cálculo de **valor contábil** (depreciação linear/decrescente).
- **Alertas** de garantia/contrato prestes a vencer.
- Relatórios/dashboards de custo por ativo, contrato, orçamento e entidade (TCO).

Alinha-se ao objetivo ITIL de *Financial Management for IT Services* (README).
