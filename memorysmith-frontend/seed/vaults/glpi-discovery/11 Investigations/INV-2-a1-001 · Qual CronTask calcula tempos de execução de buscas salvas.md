---
title: INV-2-a1-001 · Qual CronTask calcula tempos de execução de buscas salvas
aliases: [INV-2-a1-001]
tags: [investigation, consumidor/cad, saved-searches, crontask, doc-vs-code]
type: investigation
maturity: seed
reviewed: false
author: CAD Discovery (doc)
created: 2026-07-12
---

# INV-2-a1-001 · Qual CronTask calcula tempos de execução de buscas salvas

## Contexto
A documentação do usuário (saved-searches.rst) afirma que buscas salvas pesadas não são contadas por padrão e que **"A scheduled task is also offered to calculate execution times regularly"** para calcular os tempos de execução das buscas salvas. Ver [[Configuração de Alertas em Buscas Salvas]] e [[Buscas Salvas (Bookmarks)]].

## Dúvida
- Qual é a **ação automática (CronTask)** específica no código que executa esse cálculo? Nome, frequência padrão e classe.
- Como interage com a opção do administrador de forçar uma busca a ser *sempre*/*nunca* contada?

## Como resolver
Cruzar com a nota de código [[Ações Automáticas (CronTask)]] e localizar a CronTask de `SavedSearch` (provável `SavedSearch::cronCountAll` ou similar) no código-fonte do GLPI.

> [!question]
> A documentação descreve o comportamento sem nomear a tarefa; a confirmação exige inspeção do código (SRC-001).
