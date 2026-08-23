---
title: INV-2-g2-001 · Texto da aba Problems menciona changes (possível erro no doc)
aliases: [INV-2-g2-001]
tags: [investigation, consumidor/cad, doc-inconsistencia, problems]
type: investigation
status: open
author: CAD Discovery (doc)
created: 2026-07-12
---

## Dúvida / lacuna

Em `modules/tabs/problems.rst` ("Problems"), o texto descritivo diz "It also lists the **changes** already linked to the object" — aparente cópia da página `changes.rst`. Todo o restante da seção trata de **problemas** (título, tabela-resumo, imagem `problems.png`, notas), então a menção a "changes" parece ser um erro de redação do doc-fonte, não um comportamento real.

## O que dispara

Comparação lado a lado de `changes.rst` e `problems.rst`: os parágrafos de abertura são idênticos salvo o nome do objeto, e o de problems reteve "changes".

## Resolução esperada

Confirmar (via código ou UI) que a aba *Problems* lista **problemas** vinculados (esperado), não mudanças. Provável correção de documentação upstream. Não afeta as notas de Knowledge, que já assumem "problemas".

Relaciona-se com [[Aba Problemas (Problems) vinculados]].
