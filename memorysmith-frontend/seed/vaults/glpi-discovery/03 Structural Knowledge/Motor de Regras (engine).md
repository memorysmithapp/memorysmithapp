---
title: Motor de Regras (engine)
aliases: [Rule engine, Motor de regras, RuleCollection]
tags: [component, motor-de-regras, dominio/admin]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-1-031 · Motor de regras Rule RuleCollection Criteria Action|EV-1-031]]"
author: CAD Discovery
created: 2026-07-10
---

# Motor de Regras (engine)

Mecanismo genérico de automação que atravessa todo o GLPI. Uma **Rule** é um conjunto de
**critérios → ações**:

- **RuleCriteria** — condição `(campo, operador, valor)`. Operadores incluem: é / não é,
  contém, começa/termina com, existe, regex (find), e **sob/na árvore** (`UNDER`) para
  entidades/localizações; matching **AND** ou **OR**.
- **RuleAction** — o que fazer quando casa: atribuir valor, append, regex-replace, etc.
- **RuleCollection** — o **executor**: roda as regras de um tipo em **ordem de prioridade**,
  com política de parada (primeira que casa) ou acumulação, conforme o tipo.

As regras são **dados de configuração** (editáveis pela UI), não código — logo, muita lógica
de negócio da instância-alvo vive aqui. Especializações em [[Tipos de Regra]]; fluxo em
[[Execução de uma regra (criteria → action)]].
