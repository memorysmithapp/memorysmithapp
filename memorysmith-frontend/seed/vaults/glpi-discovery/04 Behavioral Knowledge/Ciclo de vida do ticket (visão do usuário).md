---
title: Ciclo de vida do ticket (visão do usuário)
aliases: [Status do ticket, Ticket life cycle, Estados do ticket]
tags: [assistance, ticket, lifecycle, status, state-machine, itil]
type: flow
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-b1-005 · Ciclo de vida do ticket (tipos, status, priorização, regras)|EV-2-b1-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Ciclo de vida do ticket (visão do usuário)

O ciclo de vida é definido a **nível de perfil**, numa matriz de ciclo de vida (menu **Administration > Profiles**), que também pode ocultar status por perfil.

## Tipos
Todo ticket é **incident** ou **request** (campo *Type*). O tipo governa ações (regras de negócio, templates, gestão de problemas) e a lista de categorias disponíveis.

## Status (fixos, ITIL)
Seis status, **não parametrizáveis nem modificáveis**: **New**, **Processing (assigned)**, **Processing (planned)**, **Pending**, **Solved**, **Closed**.

## Máquina de estados
```mermaid
stateDiagram-v2
    [*] --> New: criação
    New --> Processing_assigned: atribuído a técnico/grupo/fornecedor
    Processing_assigned --> Processing_planned: tarefa planejada
    Processing_planned --> Solved: solução encontrada
    Solved --> Closed: requerente/redator valida (ou fechamento administrativo)
    New --> [*]: requerente exclui (sem ações)
    Processing_assigned --> Pending: por requerente (ITIL)
    Processing_planned --> Pending
    Pending --> Processing_assigned
    Closed --> [*]
```

> [!note] Regras de transição
> - O **técnico** pode mudar o status a qualquer momento, em especial para **Pending** — mas o ITIL recomenda que o Pending seja acionado **pelo requerente** (ex.: pedido incompleto ou indisponibilidade).
> - O **requerente** pode **excluir** o ticket enquanto estiver em **New** e nenhuma ação tiver ocorrido.
> - Ver [[Fechamento automático e administrativo de tickets]] (E1) para a transição Solved → Closed sem validação.

## Priorização
A prioridade é calculada automaticamente por matriz a partir da **urgência** (definida pelo requerente) e do **impacto** (avaliado pelo técnico). Ver [[Priorização (urgência × impacto)]].

## Ver também (código)
- [[Ciclo de vida de um Ticket (máquina de estados)]] · [[Ticket]] · [[CommonITILObject (base de service desk)]]
