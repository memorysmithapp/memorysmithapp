---
title: INV-2-e2-003 · Exemplos incompletos nos dicionários (lacuna de documentação)
aliases: [INV-2-e2-003]
tags: [investigation, consumidor/cad, dicionarios, doc-quality]
type: investigation
maturity: seed
reviewed: false
source: "[[EV-2-e2-014 · Dicionários globais e de drop-downs|EV-2-e2-014]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!question] Pergunta
> Os exemplos de dicionário de **Manufacturer** e de **agrupamento de updates Windows** estão incompletos/em francês no `.rst` — qual é o comportamento correto documentado?

Em `dictionnaries.rst`, dois blocos `.. topic::` estão marcados pela própria documentação como confusos e trazem texto em francês não traduzido:
- "Example for Windows updates grouping, **very unclear!**" — critérios com OU (regex `/Correctif.*XP.*KB([0-9]*)/`, etc.) e ação "assigner valeur depuis regex #0".
- "Exemple for manufacturer grouping, **unclear!**" — agrupar variações de "Sun Microsystems".

## Por que é relevante
São lacunas de qualidade da documentação-fonte; a mecânica geral (agrupar por regex, acumular critérios com AND/OU, usar `#0`) está clara, mas os exemplos específicos não são confiáveis para reproduzir passo a passo.

## O que verificar
- Confirmar, no código/telas, o comportamento exato do agrupamento por regex em versões de software e do `Add regexp result` (que o doc diz valer só na importação de inventário).

> [!note] Encaminhamento
> Não bloqueia o entendimento do conceito ([[Dicionários de dados (administração)]]); registrado apenas como lacuna da fonte SRC-002.
