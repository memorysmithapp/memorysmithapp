---
title: Matriz de ciclo de vida (transições de status por perfil)
aliases: [Life cycle matrix, Matriz de ciclo de vida]
tags: [ciclo-de-vida, status, transicoes, perfil, itil, rule]
type: rule
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-b2-006 · Matriz de ciclo de vida por perfil (transições de status)|EV-2-b2-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Matriz de ciclo de vida (transições de status por perfil)

Mecanismo que **controla as mudanças de status** de tickets, problemas e mudanças. **Cada
perfil tem a sua própria matriz de ciclo de vida**, o que permite refinar qual perfil pode
fazer qual transição — a matriz pode **bloquear ações**. Se um status não é ativado, ele nem
aparece na lista de status do objeto.

- **Ticket** — há matriz separada para a **interface padrão** e para a **simplificada**
  (nesta, define se o usuário pode fechar um ticket com solução aprovada e reabri-lo).
  Ex.: um ticket `New` nunca vai a `Waiting` se esse status não for proposto; um solicitante
  pode não ter acesso ao formulário de validação de solução.
- **Problema** — ex.: um problema `New` nunca vai direto a `Solved` se esse status não for
  proposto.
- **Mudança** — ex.: uma mudança `New` nunca fica `Accepted` antes de passar por `Evaluation`
  ou `Validation`.

Confirma, do lado da documentação, que as transições de status são **configuráveis por
perfil** — exatamente a lacuna levantada na engenharia reversa do código em
[[INV-1-005 · Regras exatas de transição de status por perfil]]. Complementa a
[[Ciclo de vida de um Ticket (máquina de estados)]] e [[SLM, SLA e OLA]]. As transições exatas
default estão só em capturas de tela — ver
[[INV-2-b2-001 · Matriz de ciclo de vida — transições exatas por perfil (default)]].
