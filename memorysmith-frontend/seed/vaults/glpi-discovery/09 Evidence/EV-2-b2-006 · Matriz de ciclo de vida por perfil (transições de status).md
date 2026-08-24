---
title: EV-2-b2-006 · Matriz de ciclo de vida por perfil (transições de status)
aliases: [EV-2-b2-006]
tags: [evidence, lifecycle, ciclo-de-vida, status, transicoes, perfil, itil]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/assistance/lifecyclematrix.rst · Life cycle matrix (documento inteiro)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-b2-006 · Matriz de ciclo de vida por perfil (transições de status)

> [!quote] Cada perfil tem sua matriz
> "Each profile having its own life cycle matrix, it is possible to refine which profile will be able to do which action. The life cycle matrix controls object status changes, which implies it can block some actions. If a status is not activated, it won't be present in the list of status of the object." (lifecyclematrix.rst)

> [!quote] Matriz de ciclo de vida do Ticket
> Há uma matriz para a interface padrão e outra para a simplificada (imagens `lifecycle_tickets_standard.png` e `lifecycle_tickets_simple.png`). Exemplos do doc: "a `New` ticket will never be put to `Waiting`, this status being not proposed"; "a requester will not have access to solution validation form, because a solved ticket for which solution has been approved becomes closed, which is not authorized by the example". Para a interface simplificada: define se o usuário pode fechar um ticket (solução aprovada) e reabri-lo mesmo fechado. (lifecyclematrix.rst)

> [!quote] Matriz de ciclo de vida do Problema
> Imagem `lifecycle_problems.png`. Exemplo: "a `New` problem will never be put directly to status `Solved`, this status being not proposed in the problem." (lifecyclematrix.rst)

> [!quote] Matriz de ciclo de vida da Mudança
> Imagem `lifecycle_changes.png`. Exemplo: "a `New` change will never be `Accepted` before having its status put to `Evaluation` or `Validation`, this status being not proposed in the change." (lifecyclematrix.rst)

> [!note] Transições exatas apenas em imagens
> O texto descreve o mecanismo (matriz de status permitidos, configurável por perfil, capaz de bloquear ações) e dá exemplos, mas a matriz completa de transições permitidas está apenas nas capturas de tela. Ver [[INV-2-b2-001 · Matriz de ciclo de vida — transições exatas por perfil (default)]], que dialoga com a investigação de código [[INV-1-005 · Regras exatas de transição de status por perfil]].

## Sustenta
- [[Matriz de ciclo de vida (transições de status por perfil)]]
