---
title: EV-2-e2-009 · Criação de uma regra - critérios, operadores, regex e AND-OR
aliases: [EV-2-e2-009]
tags: [evidence, regras, criterios, operadores, regex, doc]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/administration/rules/rulesmanagement.rst · Create a rule"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] Documentação (rulesmanagement.rst, Create a rule)
> "A rule is composed of a series of criteria. Depending on the option chosen (OR/AND) one or all of the criteria must be verified to trigger an action list."

- Um mecanismo de **preview** permite testar as regras antes de colocá-las em produção.
- **Operador lógico** (aviso no doc): **OR** → a regra aplica a partir do 1º critério correspondente, ignorando os seguintes; **AND** → todos os critérios devem ser satisfeitos.

**Critérios (operadores) disponíveis:**
- *simples*: is / is not / contains / does not contain / starts with / ends with / **under** (para dropdowns em árvore: este dropdown ou um filho) / **not under**.
- *complexos*: **regular expression match** / **regular expression does not match**.

Expressões regulares retornam um ou mais resultados usáveis nas ações via diretiva `#x` (onde x é o número do resultado). Exemplo: critério `name matching /DESKTOP\_(.\*)/`; se o objeto se chama `DESKTOP_0001`, pode-se usar `0001` na ação via `#0`.

**Passo a passo (exemplo Location Rules)**: Administration > Rules > Location Rules → **+ Add** → preencher nome, operador lógico, comentários, descrição, active → adicionar critério (ex.: Agent > Inventory tag = France) → adicionar ação (ex.: atribuir a localização Paris) → testar via **Test rules engines**.

## Sustenta
- [[Criação de uma regra (passo a passo)]]
- [[Critérios e operadores do motor de regras]]
