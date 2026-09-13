---
title: Projetos de Eficiência Energética (ANEEL)
aliases:
  - projetos-de-eficiencia-energetica
tags:
  - eficiencia-energetica
  - pee
  - ren-920
  - projetos
  - dados-abertos
  - aneel
type: dataset
maturity: seed
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: monthly
data_source: https://dadosabertos.aneel.gov.br/dataset/projetos-de-eficiencia-energetica
coverage: a partir de 1999
---

> [!abstract]
> Projetos do Programa de Eficiência Energética, com investimento, energia economizada e demanda retirada da ponta. Substituiu dois conjuntos hoje descontinuados.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 1999 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/projetos-de-eficiencia-energetica) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 6 (2 no DataStore, consultáveis por API) |
| Granularidade | projeto |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=projetos-de-eficiencia-energetica"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset projetos-de-eficiencia-energetica`
Destino: `data/raw/aneel/projetos-de-eficiencia-energetica/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Fiscalização e Institucional]]
