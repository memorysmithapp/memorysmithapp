---
title: INV-1-003 · Comportamento de produção via plugins fora do repo
aliases: [INV-1-003]
tags: [investigation, consumidor/cad, plugins, escopo]
type: investigation
status: open
maturity: seed
reviewed: false
source: "[[EV-1-007 · Hooks de plugin no ciclo de vida dos itens|EV-1-007]]"
author: CAD Discovery
created: 2026-07-10
---

# INV-1-003 · Comportamento de produção via plugins fora do repo

> [!question] Pergunta aberta (para o consultor)
> A instância GLPI-alvo do cliente usa **plugins**? Se sim, quais? Parte relevante das
> regras de negócio pode estar em plugins que **não estão neste repositório** (só o core
> GLPI foi fornecido como `SRC-001`).

Impacto direto na completude da extração de requisitos. Requer validação humana
(`/cad:backlog`) ou fornecimento do código dos plugins como nova fonte.
