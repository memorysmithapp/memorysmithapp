---
title: Gestão de Contratos (processo)
aliases: [Contract Management, Supplier Management]
tags: [process, contrato, dominio/gestao]
type: process
status: confirmed
source:
  - "[[EV-1-023 · Contract com renovação alerta custos e vínculo a itens|EV-1-023]]"
  - "[[EV-1-024 · Supplier Contact e Budget|EV-1-024]]"
author: CAD Discovery
created: 2026-07-10
---

# Gestão de Contratos (processo)

Processo de controle de contratos e da relação com fornecedores (ITIL Supplier Management),
apoiado por [[Contratos (Contract)]] e [[Fornecedores e Contatos]].

## Fluxo
1. **Cadastro** — contrato com tipo, fornecedor, datas, valores/custos e regras de renovação.
2. **Vínculo** — associação a **itens cobertos** (`Contract_Item`): ativos, software, linhas.
3. **Acompanhamento** — **alertas** de vencimento e de aviso prévio (renovação tácita/expressa),
   com antecedência configurada na entidade (executados por cron — ver
   [[INV-1-008 · Alertas e crons de vencimento]]).
4. **Renovação/encerramento** — renovar (tácita/expressa) ou encerrar; histórico preservado.
5. **Custos** — `ContractCost` alimenta a [[Gestão Financeira de TI]].

Dá visibilidade sobre cobertura de suporte/garantia dos ativos e evita lapsos de contrato.
