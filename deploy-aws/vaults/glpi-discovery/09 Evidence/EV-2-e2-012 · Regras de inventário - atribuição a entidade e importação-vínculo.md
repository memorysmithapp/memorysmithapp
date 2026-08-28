---
title: EV-2-e2-012 · Regras de inventário - atribuição a entidade e importação-vínculo
aliases: [EV-2-e2-012]
tags: [evidence, regras, inventario, entidade, importacao, doc]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/administration/rules/inventorytools.rst · Rules for inventory agent"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] Documentação (inventorytools.rst)

**Rules for assigning an item to an entity**: atribuem automaticamente um item de uma ferramenta de inventário a uma entidade e a uma localização.
- Critérios: campos genéricos (name, description, serial number, domain, IP address, subnet) + campos vindos da ferramenta de inventário (se disponíveis).
- Ações: **ignore import**; **assign to an entity**; **assign to an entity using value from regular expression**; **assign to a location**.
- `.. warning::` o motor **para na primeira regra correspondente** → é preciso ordenar bem a lista (regras mais prováveis primeiro). As regras de atribuição a entidade só são executadas na **importação inicial** da máquina; depois disso não há processo automático para mudar de entidade — usar **transfer** manual. Blacklist pode excluir valores (IP/MAC).

**Rules for importing and linking computers**: controla importar/vincular/recusar máquinas.
Fluxo de importação de um computador:
1. o computador passa pelo motor de **atribuição de entidade**; se não retorna entidade, a máquina **não é importada**; senão continua.
2. passa pelo motor de **importação e vínculo**: importado na entidade de destino, vinculado a outro já presente no GLPI, ou não importado.
- Critérios: campos genéricos + campos da ferramenta + entidade de destino + status usado para buscar máquina já presente.
- Ações: ignorar import / vincular se possível / importar se possível / recusar.
- `.. warning::` para na primeira regra; a busca por máquina já presente ocorre **apenas na entidade de destino**.
- Exemplos: recusar imports de um servidor específico; vincular por serial já presente (status "in stock"); recusar por serial errado ("To be Filled By OEM").

## Sustenta
- [[Regras de atribuição de item a entidade (inventário)]]
- [[Regras de importação e vínculo de computadores]]
- [[Importação de computador do inventário (fluxo)]]
