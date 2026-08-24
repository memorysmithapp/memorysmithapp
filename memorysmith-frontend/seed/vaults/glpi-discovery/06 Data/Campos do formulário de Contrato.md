---
title: Campos do formulário de Contrato
aliases: [Contract fields]
tags: [data, management, contract, fields, doc]
type: table
maturity: evergreen
reviewed: false
source: "[[EV-2-d1-002 · Contratos — objetivos, campos específicos e abas|EV-2-d1-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos do formulário de Contrato

Campos específicos do formulário de [[Contrato na interface (Contract) — visão do usuário|contrato]] (além dos comuns como nome):

| Campo | Semântica |
|-------|-----------|
| **Contract type** | Tipo do contrato; nenhum por padrão, configurado no [[Dropdown (lista suspensa customizável)|dropdown]]. |
| **Number** | Número do contrato. |
| **Start date** | Data de início; **base de todos os cálculos de periodicidade**. |
| **Initial contract period** | Período inicial; junto com Start date faz aparecer a **data de fim** (em vermelho se expirado). |
| **Notice** | Prazo de aviso; usado para disparar notificações de alerta. |
| **Account number** | Número de conta; conecta ao software contábil da empresa. |
| **Contract renewal period** | Duração após a qual a renovação fica disponível. |
| **Invoice period** | Duração entre faturas. |
| **Renewal** | *Tacit* (renovação automática se ninguém encerrar) ou *Express* (requer acordo). |
| **Max number of items** | Bloqueia anexar novos itens ao ultrapassar este número. |
| **Support hours** | Horas de suporte; distingue dias úteis, sábados e domingos/feriados. |

> [!note] Ponte doc×código
> Semântica financeira relacionada a [[Orçamentos e Custos]] e [[Gestão Financeira de TI]]; entidade [[Contratos (Contract)]].
