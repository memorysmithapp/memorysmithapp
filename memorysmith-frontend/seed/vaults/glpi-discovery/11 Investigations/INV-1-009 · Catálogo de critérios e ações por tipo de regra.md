---
title: INV-1-009 · Catálogo de critérios e ações por tipo de regra
aliases: [INV-1-009]
tags: [investigation, consumidor/cad, motor-de-regras]
type: investigation
status: open
maturity: seed
reviewed: false
source: "[[EV-1-032 · Tipos de regra especializados|EV-1-032]]"
author: CAD Discovery
created: 2026-07-10
---

# INV-1-009 · Catálogo de critérios e ações por tipo de regra

> [!question] Pergunta aberta
> Para cada tipo (RuleRight, RuleTicket, RuleAsset, RuleImportAsset, dicionários…), quais são
> os **critérios** e **ações** disponíveis (métodos `getCriterias()`/`getActions()`)? E qual a
> política de execução (parar na 1ª vs acumular) de cada um?

Necessário para documentar exaustivamente o que é automatizável sem código. Resolver lendo
`getCriterias()/getActions()` de cada subclasse de `Rule`. Complementa a decisão sobre a matriz
de status ([[INV-1-005 · Regras exatas de transição de status por perfil]]).
