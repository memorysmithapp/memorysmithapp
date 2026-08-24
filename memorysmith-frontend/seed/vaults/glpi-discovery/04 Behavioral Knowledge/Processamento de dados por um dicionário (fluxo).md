---
title: Processamento de dados por um dicionário (fluxo)
aliases: [Dictionary processing, Fluxo de dicionário]
tags: [dicionarios, regras, fluxo, doc]
type: flow
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-e2-013 · Dicionários de dados - conceito e funcionamento|EV-2-e2-013]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Um **dicionário** processa cada dado de entrada usando o motor de regras, com política *stop on first matching rule*.

## Passos
1. O dado a ser adicionado **entra no dicionário**;
2. o motor de regras executa todas as regras aplicáveis a esse tipo de dado e **para na primeira regra correspondente**;
3. o dado **modificado** é retornado pelo dicionário e inserido na base.

## Reprocessamento de dados existentes
- Botão **Replay the dictionary rules** (abaixo da lista de regras) reaplica as regras sobre dados já existentes.
- Script CLI `scripts/compute_dictionnary.php` executa o processamento em linha de comando (evita limite de execução, mais rápido).

> [!warning] Cuidados
> Ajustar `memory_limit` do PHP em bases grandes; testar em base de teste e fazer backup antes. A ação *Add regexp result* em versão de software só vale na importação vinda do inventário — é ignorada ao reaplicar em base existente.

Ver [[Dicionários de dados (administração)]] e [[Motor de Regras na Administração (gestão de regras)]].
