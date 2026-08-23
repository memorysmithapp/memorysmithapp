---
title: Critérios e operadores do motor de regras
aliases: [Rule criteria operators, Operadores de regra]
tags: [regras, criterios, operadores, regex, dados, doc]
type: table
status: confirmed
source: "[[EV-2-e2-009 · Criação de uma regra - critérios, operadores, regex e AND-OR|EV-2-e2-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Operadores disponíveis para os **critérios** de uma regra (ver [[Criação de uma regra (passo a passo)]]).

## Operadores simples
- **is** / **is not**
- **contains** / **does not contain**
- **starts with** / **ends with**
- **under** (para dropdowns em árvore: este dropdown ou um dos filhos)
- **not under** (nem este nem os filhos)

## Operadores complexos
- **regular expression match**
- **regular expression does not match**

## Uso de resultados de regex
Expressões regulares retornam um ou mais resultados usáveis nas **ações** via diretiva `#x` (x = número do resultado, iniciando em `#0`).

Exemplo: critério `name matching /DESKTOP\_(.\*)/`; para `DESKTOP_0001`, a ação pode usar `0001` via `#0`.

## Operador lógico entre critérios
- **OR**: aplica a partir do 1º critério correspondente;
- **AND**: exige todos os critérios.

> [!note] Ponte doc×código e investigação
> A lista de critérios/ações **por tipo de regra** varia (ver [[Regras de negócio de tickets (administração)]], [[Regras de atribuição de item a entidade (inventário)]], etc.) e responde parcialmente à investigação de código [[INV-1-009 · Catálogo de critérios e ações por tipo de regra]]. Ver [[INV-2-e2-001 · Correspondência entre tipos de regra do doc e o catálogo do código]].
