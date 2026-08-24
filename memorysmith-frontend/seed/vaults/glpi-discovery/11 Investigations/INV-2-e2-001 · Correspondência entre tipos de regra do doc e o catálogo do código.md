---
title: INV-2-e2-001 · Correspondência entre tipos de regra do doc e o catálogo do código
aliases: [INV-2-e2-001]
tags: [investigation, consumidor/cad, regras, criterios, acoes]
type: investigation
status: open
maturity: seed
reviewed: false
source: "[[EV-2-e2-009 · Criação de uma regra - critérios, operadores, regex e AND-OR|EV-2-e2-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!question] Pergunta
> Os tipos de regra e seus critérios/ações descritos na documentação de administração correspondem exatamente ao catálogo enumerado no código?

A documentação enumera vários tipos de regra (atribuição de ticket via coletor de e-mail, autorizações de usuário, categoria de software, regras de negócio de tickets, atribuição de item a entidade, importação/vínculo de computadores, **Location Rules**, dicionários) e, para cada um, um subconjunto de critérios e ações. Porém **não fornece um catálogo exaustivo** de todos os critérios/ações por tipo.

## Por que é relevante
Isto **responde parcialmente** à investigação de código [[INV-1-009 · Catálogo de critérios e ações por tipo de regra]]: o doc confirma, na ótica de produto, tipos e alguns critérios/ações (ex.: software → publisher/name/comment → assign category; entidade → name/serial/IP/subnet → ignore/assign entity/assign location; negócio de tickets → todos os atributos do ticket + headers → modificar atributos / atribuir a device / validação).

## O que verificar
- Se a lista de tipos de regra do código bate com a do doc (o doc cita *Location Rules*, não listado explicitamente no menu "the different rules").
- Se os operadores documentados (is/is not/contains/starts/ends/under/not under/regex) cobrem 100% dos operadores implementados.
- Se há tipos de regra no código não documentados aqui (ou vice-versa).

> [!note] Encaminhamento
> Cruzar com as notas de código [[Tipos de Regra]], [[Motor de Regras (engine)]] e a investigação [[INV-1-009 · Catálogo de critérios e ações por tipo de regra]].
