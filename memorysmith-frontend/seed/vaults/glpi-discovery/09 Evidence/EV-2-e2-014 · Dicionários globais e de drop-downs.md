---
title: EV-2-e2-014 · Dicionários globais e de drop-downs
aliases: [EV-2-e2-014]
tags: [evidence, dicionarios, software, fabricante, impressoras, dropdowns, doc]
type: evidence
status: confirmed
source: "SRC-002 · modules/administration/dictionnaries.rst · Global dictionaries / Drop-downs"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] Documentação (dictionnaries.rst, Global dictionaries e Drop-downs)

**Global dictionaries:**
- **Software**: modifica dados de software (name, version, manufacturer) para completar ou mesclar softwares (ex.: agrupar Mozilla Firefox 3.0 e 3.6) ou adicionar fabricante ausente. Permite também **redirecionar a criação** de software para uma entidade dada (ação *Entity*), equivalente à opção geral *Entity for software* da entidade. `.. warning::` a ação **Add regexp result** numa versão só vale ao importar dados de ferramenta de inventário; é ignorada ao reaplicar o dicionário sobre base existente. Critérios acumulados com AND (ou OU no exemplo de updates Windows).
- **Manufacturer**: agrupa sob um nome único variações de nomes de fabricante vindos do inventário.
- **Printers**: modifica info de impressoras por fabricante e/ou nome; pode **rejeitar import** (ex.: nome começando com `//`), agrupar sob mesmo nome, atribuir fabricante ou forçar tipo de gestão (global/unitário).

**Drop-downs** (dicionários relacionados a inventário: tipos e modelos de itens, SO, versão e service pack):
- **Models**: critérios = fabricante e modelo do item (ex.: transformar número técnico em nome comercial mantendo o número técnico).
- **Types**: único critério = tipo do item (ex.: harmonizar nomes de periféricos → "Keyboard").
- **Operating systems**: conforme o dicionário escolhido, critério baseado no próprio SO, no service pack ou na versão do SO.

## Sustenta
- [[Dicionários de dados (administração)]]
