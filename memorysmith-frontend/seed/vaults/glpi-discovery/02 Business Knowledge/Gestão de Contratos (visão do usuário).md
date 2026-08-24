---
title: Gestão de Contratos (visão do usuário)
aliases: [Contracts management]
tags: [capability, management, contract, financial, doc]
type: capability
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-d1-002 · Contratos — objetivos, campos específicos e abas|EV-2-d1-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Gestão de Contratos (visão do usuário)

O GLPI suporta a gestão de contratos para administrar tipos como empréstimo (*loan*), manutenção, suporte, etc. Segundo a documentação, a capacidade permite:

- **inventariar** todos os contratos ligados aos ativos da organização;
- **integrar** os contratos na gestão financeira do GLPI (via custos e orçamentos);
- **antecipar e acompanhar** a renovação dos contratos (datas, notificações).

O ciclo administrativo é apoiado por campos como *Start date* (base de todos os cálculos de periodicidade), *Initial contract period* (que revela a data de fim, marcada em vermelho quando expirada), *Contract renewal period*, *Invoice period* e o tipo de renovação *Tacit*/*Express*. Ver [[Campos do formulário de Contrato]] e [[Abas do formulário de Contrato]].

> [!note] Ponte doc×código
> Complementa a nota de código [[Gestão de Contratos (processo)]] e a entidade [[Contratos (Contract)]]. A integração financeira liga-se a [[Gestão Financeira via Orçamentos (visão do usuário)]] e [[Orçamentos e Custos]].

Relaciona-se com [[Alertas de renovação e vencimento (contratos, licenças, certificados)]] e com [[Adicionar um custo a um contrato (procedimento)]].
