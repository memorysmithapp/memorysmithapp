---
title: Criação de uma regra (passo a passo)
aliases: [Create a rule, Criar regra]
tags: [regras, criacao, criterios, acoes, doc]
type: use-case
status: confirmed
source: "[[EV-2-e2-009 · Criação de uma regra - critérios, operadores, regex e AND-OR|EV-2-e2-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Uma **regra** é composta por uma série de **critérios** e uma lista de **ações**. O operador lógico define se **um** (OR) ou **todos** (AND) os critérios devem ser verificados para disparar as ações.

## Passo a passo (exemplo: Location Rules)
1. Em **Administration > Rules > Location Rules**, clicar **+ Add**.
2. Preencher nome, **operador lógico**, comentários, descrição e marcar **Active**.
3. Na aba **Criteria**, "Add a new criterion" (ex.: *Agent > Inventory tag* = `France`).
4. Na aba **Actions**, "Add a new action" (ex.: atribuir a localização Paris).
5. Testar com **Test rules engines** (ou botão **Test** do formulário).

## Operador lógico
- **OR**: a regra aplica a partir do 1º critério correspondente, ignorando os seguintes;
- **AND**: todos os critérios devem ser satisfeitos.

Ver [[Critérios e operadores do motor de regras]] para a lista de operadores e o uso de expressões regulares.

> [!note] Ponte doc×código
> Corresponde ao fluxo de código [[Execução de uma regra (criteria → action)]] e ao [[Motor de Regras (engine)]].
