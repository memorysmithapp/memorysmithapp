---
title: EV-2-e2-013 · Dicionários de dados - conceito e funcionamento
aliases: [EV-2-e2-013]
tags: [evidence, dicionarios, regras, doc]
type: evidence
status: confirmed
source: "SRC-002 · modules/administration/dictionnaries.rst · Dictionaries / Configure data dictionaries"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] Documentação (dictionnaries.rst, introdução e Configure)
> "Dictionary's allow to modify data already existing in GLPI or new data in order to group redundant data. Dictionaries are based on GLPI **rules engine** and are available for some types of items (software, suppliers, drop-downs)."

- As regras de um dicionário modificam valores inseridos manualmente **ou** automaticamente (via ferramenta de inventário ou plugins, ex.: injetor de CSV).
- **Import/export/duplicação** disponíveis para dicionários ou regras — global (página do dicionário) ou em lote via ações massivas (útil na migração pré-produção → produção). Formato **XML**.

**Como um dicionário funciona:**
1. o dado a adicionar entra no dicionário;
2. o motor de regras executa todas as regras aplicáveis a esse tipo de dado e **para na primeira regra correspondente**;
3. o dado modificado é retornado e inserido na base.

- Botão **Replay the dictionary rules** (abaixo da lista de regras) reexecuta as regras sobre dados já existentes na base.
- `.. warning::` se a base é grande, ajustar `memory_limit` do PHP (processamento pesado).
- `.. hint::` testar em base de teste e fazer backup antes; existe o script `scripts/compute_dictionnary.php` para rodar o processamento em **linha de comando** (evita limite de execução e acelera).

## Sustenta
- [[Dicionários de dados (administração)]]
- [[Processamento de dados por um dicionário (fluxo)]]
- [[Import e Export de regras, dicionários e formulários (XML)]]
