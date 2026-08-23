---
title: Importação de computador do inventário (fluxo)
aliases: [Import computer flow, Fluxo de importação de computador]
tags: [inventario, importacao, entidade, regras, fluxo, doc]
type: flow
status: confirmed
source: "[[EV-2-e2-012 · Regras de inventário - atribuição a entidade e importação-vínculo|EV-2-e2-012]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Ao chegar do agente de inventário, um computador passa por **dois motores de regras encadeados**.

## Passos
1. **Motor de atribuição de entidade**: o computador é avaliado. Se **não retorna entidade**, a máquina **não é importada**. Se retorna, o processo continua.
2. **Motor de importação e vínculo**: conforme as regras, o computador é **importado** na entidade de destino, **vinculado** a outro já presente no GLPI, ou **não importado**.

## Observações
- Ambos os motores **param na primeira regra correspondente** → ordenar bem as listas.
- A busca por máquina já presente ocorre **apenas na entidade de destino**.
- As regras de atribuição a entidade só rodam na **importação inicial**; depois disso, mudança de entidade exige **transfer** manual ou o modelo de transferência automática por inventário (aba Assets da entidade).

```mermaid
flowchart TD
    A[Computador do agente de inventário] --> B{Motor de atribuição<br/>de entidade}
    B -->|sem entidade| X[Não importado]
    B -->|entidade definida| C{Motor de importação<br/>e vínculo}
    C -->|importar| D[Importado na entidade de destino]
    C -->|vincular| E[Vinculado a máquina existente]
    C -->|recusar| X
```

Ver [[Regras de atribuição de item a entidade (inventário)]], [[Regras de importação e vínculo de computadores]] e [[Fluxo de inventário nativo]].
