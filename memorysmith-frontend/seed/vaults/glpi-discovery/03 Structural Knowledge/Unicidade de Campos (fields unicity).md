---
title: Unicidade de Campos (fields unicity)
aliases: [Fields unicity, Unicity criteria, Critérios de unicidade]
tags: [unicidade, duplicatas, configuracao, regra]
type: concept
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-f1-002 · Mecanismo de unicidade de campos|EV-2-f1-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

O GLPI possui um mecanismo de **verificação de unicidade** executado antes da criação de um objeto no banco. Ele permite **rastrear e/ou bloquear** a presença de objetos duplicados com base na coincidência de certos campos (ex.: computadores pelo número de série).

## Definição de uma regra de unicidade
- Definida por um **nome**, um **tipo de objeto** e **um ou mais campos**.
- Com múltiplos campos, todos são checados **em conjunto** (AND), não individualmente.
- A checagem só se aplica se o campo **não estiver vazio** — objetos com o campo em branco são permitidos mesmo repetidos.
- Cada regra oferece: **recusar** a adição do objeto e/ou **notificar** quando não for único.
- Aplica-se a adições **manuais** e a adições de **fonte externa** (ex.: ferramenta de inventário — ver [[Inventário automático (processo)]]).
- Critérios presentes nos **blacklists** são ignorados no cálculo.

## Abas
- **Duplicates**: lista os valores atualmente duplicados para os critérios. Também há abas Historical, Debug e All.

> [!note]
> Difere do [[Motor de Regras (engine)]] (regras de negócio): a unicidade é um controle de integridade prévio à inserção. Relaciona-se ao [[Dicionário de dados (dictionary)]] pelos blacklists.
