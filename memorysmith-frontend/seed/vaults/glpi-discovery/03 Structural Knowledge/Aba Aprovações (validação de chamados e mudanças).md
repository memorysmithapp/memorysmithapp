---
title: Aba Aprovações (validação de chamados e mudanças)
aliases: [Approvals tab, Aba Approvals, Aprovações]
tags: [tab, approvals, validation, ticket, change, workflow]
type: component
status: confirmed
source: "[[EV-2-g3-008 · Aba Aprovações (validação de chamados e mudanças)|EV-2-g3-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Aba Aprovações (validação de chamados e mudanças)

A aba **Approvals** permite que um **ticket** ou uma **change** seja validado (ou não) por um terceiro ou por um grupo. É a visão de usuário da regra de código [[Validação e aprovação (regra)]].

> [!note] Validação mínima requerida (limiar)
> - **0%** — informativo apenas; não gera recusa global mesmo sem validação.
> - **50%** — aprovação global concedida se **metade** dos validadores aprovar.
> - **100%** — **todas** as validações devem ser aprovadas.

> [!note] Enviar um pedido de aprovação
> Botão **Send an approval request**; pode-se usar um **Template**; escolher o tipo de aprovador (**user**, **group**, **group user(s)**), o usuário/grupo, um comentário e opcionalmente um documento. Não é possível selecionar vários grupos/usuários de uma vez — um pedido por grupo/usuário. Um grupo inexistente pode ser criado pelo **+**.

## Estados
Três status: **Waiting for approval**, **Refused**, **Granted** (também visíveis em lista). Usuários podem **mudar** seu status (concedido ou negado) direto do ticket/change. Apagar uma aprovação **não** altera o status final — é preciso reenviar pedidos.

## Ver também
- [[Validação e aprovação (regra)]] · [[Abas do formulário de Ticket]] · [[Gestão de Mudanças na interface (procedimento)]]
