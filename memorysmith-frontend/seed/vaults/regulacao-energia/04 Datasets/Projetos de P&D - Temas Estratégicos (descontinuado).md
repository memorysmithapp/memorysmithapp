---
title: Projetos de P&D - Temas Estratégicos (descontinuado)
aliases:
  - projetos-de-p-d-temas-estrategicos
tags:
  - descontinuado
  - p-e-d
  - dados-abertos
  - aneel
type: dataset
status: seed
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: ad-hoc
data_source: https://dadosabertos.aneel.gov.br/dataset/projetos-de-p-d-temas-estrategicos
coverage: a partir da REN 316/2008
---

> [!abstract]
> Projetos de temas estratégicos publicados a partir da Res. Normativa 316/2008. Substituído por Projetos de P&D em Energia Elétrica.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir da REN 316/2008 · Cadência da fonte: ad hoc / conforme evento

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/projetos-de-p-d-temas-estrategicos) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, XML, JSON |
| Recursos | 4 (0 no DataStore, consultáveis por API) |
| Granularidade | projeto |
| Cadência declarada | ad hoc / conforme evento |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=projetos-de-p-d-temas-estrategicos"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset projetos-de-p-d-temas-estrategicos`
Destino: `data/raw/aneel/projetos-de-p-d-temas-estrategicos/<AAAA-MM-DD>/`

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
