---
title: Autos de Infração por Área de Fiscalização (descontinuado)
aliases:
  - autos-de-infracao-cadastrados-pelas-areas-de-fiscalizacao-modelo-vigente-ate-2015
tags:
  - descontinuado
  - fiscalizacao
  - auto-de-infracao
  - dados-abertos
  - aneel
type: dataset
status: seed
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: ad-hoc
data_source: https://dadosabertos.aneel.gov.br/dataset/autos-de-infracao-cadastrados-pelas-areas-de-fiscalizacao-modelo-vigente-ate-2015
coverage: 1998 a 2017
---

> [!abstract]
> Quantidades e valores de autos de infração cadastrados de 1998 a 2017, no modelo vigente até 2015.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: 1998 a 2017 · Cadência da fonte: ad hoc / conforme evento

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/autos-de-infracao-cadastrados-pelas-areas-de-fiscalizacao-modelo-vigente-ate-2015) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, XML, JSON |
| Recursos | 3 (0 no DataStore, consultáveis por API) |
| Granularidade | agregado |
| Cadência declarada | ad hoc / conforme evento |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=autos-de-infracao-cadastrados-pelas-areas-de-fiscalizacao-modelo-vigente-ate-2015"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset autos-de-infracao-cadastrados-pelas-areas-de-fiscalizacao-modelo-vigente-ate-2015`
Destino: `data/raw/aneel/autos-de-infracao-cadastrados-pelas-areas-de-fiscalizacao-modelo-vigente-ate-2015/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!warning] Conjunto descontinuado
> A ANEEL marcou este conjunto como descontinuado. Serve para série histórica; não recebe dado novo.

## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Catálogo de Dados Abertos ANEEL]]
