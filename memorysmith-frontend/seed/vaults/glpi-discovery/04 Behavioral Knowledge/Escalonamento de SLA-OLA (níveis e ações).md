---
title: Escalonamento de SLA/OLA (níveis e ações)
aliases: [Escalation levels, Níveis de escalonamento]
tags: [sla, ola, escalonamento, escalation, nivel, acoes]
type: flow
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-009 · Níveis de serviço (SLA-OLA) e escalonamento|EV-2-f3-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Escalonamento de SLA/OLA (níveis e ações)

Um SLA/OLA pode ter **níveis de escalonamento** (*escalation levels*). Configuração: adicionar um SLA/OLA a um service level, clicar em seu nome, e então adicionar níveis; clicando no nome de um nível configuram-se os **critérios de disparo** e as **ações** a executar.

Cada nível dispara **ações automáticas** que visam resolver o ticket o quanto antes. Um nível é acionado **antes ou depois** da data de expiração do SLA/OLA, conforme um *delay* definido.

- Exemplo de ação: *um dia antes* do prazo, o ticket é atribuído ao **suporte nível 2** e a **prioridade** muda para **Alta**.
- Níveis podem ser condicionados por **critérios**. Sem critérios, o nível dispara sempre; com critérios, eles são checados antes de aplicar. Ex.: 1 dia antes do vencimento, enviar lembrete ao administrador **se** o ticket ainda estiver em status *New* (critério `Status is New`).

Quando o SLA/OLA é (re)atribuído a um ticket, ele é completamente *replayed* e as ações dos níveis são reexecutadas. A avaliação periódica dos níveis roda pelas ações `slaticket` e `olaticket` (ver [[Catálogo de ações automáticas (crontasks)]]).

> [!note] Conexão com a investigação de código [[INV-1-004 · Ações de escalonamento de SLA]]: o doc confirma que os níveis executam ações automáticas e enumera exemplos (atribuir a grupo/nível de suporte, mudar prioridade, enviar lembrete/notificação), mas **não** apresenta a lista fechada e completa de tipos de ação disponíveis.

## Ver também
- [[Níveis de serviço (SLA e OLA) na configuração]]
- [[SLA e níveis de serviço (regra)]]
