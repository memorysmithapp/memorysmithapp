---
title: EV-2-g3-008 · Aba Aprovações (validação de chamados e mudanças)
aliases: [EV-2-g3-008]
tags: [evidence, tab, approvals, validation, ticket, change]
type: evidence
status: confirmed
source: "SRC-002 · source/tabs/approvals.rst · Approvals"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-g3-008 · Aba Aprovações (validação de chamados e mudanças)

> [!quote] source/tabs/approvals.rst — "Approvals"
> "Approvals allow a ticket or a change to be validated (or not) by a third party or a group."
> **Validação mínima requerida** define o limiar de aprovação global:
> - **0%** — valor informativo apenas; mesmo sem validação, não há recusa global.
> - **50%** — se metade dos validadores aprova, a aprovação global é concedida.
> - **100%** — todas as validações devem ser aprovadas para o status global ser concedido.
> Enviar pedido: "Send an approval request"; pode-se usar um **Template**; escolher o tipo de aprovador (**user, group, group user(s)**), o usuário/grupo, um comentário, opcionalmente um documento, e **+ Add**.
> "you can't select several groups or users at once, you have to make separate approval requests for each group or user."
> É possível adicionar um grupo (via **+** em Approver) se ele não existir.

> [!quote] Estados
> Três status: **Waiting for approval**, **Refused**, **Granted**. As aprovações também podem ser vistas em lista no mesmo local.
> Usuários podem **mudar seu status de aprovação** (previamente concedido ou negado), direto do ticket ou change.
> É possível **apagar** uma aprovação; isso não altera o status final, sendo necessário reenviar pedidos para obter novo resultado.

## Sustenta
- [[Aba Aprovações (validação de chamados e mudanças)]]
