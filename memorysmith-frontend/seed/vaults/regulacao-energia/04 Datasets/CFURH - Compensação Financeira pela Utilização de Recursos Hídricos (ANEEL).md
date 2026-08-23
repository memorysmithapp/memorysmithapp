---
title: CFURH - Compensação Financeira pela Utilização de Recursos Hídricos (ANEEL)
aliases:
  - cfurh
tags:
  - cfurh
  - royalties
  - itaipu
  - municipios
  - dados-abertos
  - aneel
type: dataset
status: seed
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: monthly
data_source: https://dadosabertos.aneel.gov.br/dataset/cfurh
coverage: a partir de 1993
---

> [!abstract]
> Compensação financeira paga pelas usinas hidrelétricas aos entes federativos atingidos, e royalties de Itaipu — dois institutos distintos, com sistemática e legislação próprias, reunidos no mesmo conjunto.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 1993 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/cfurh) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, ZIP, PARQUET |
| Recursos | 18 (7 no DataStore, consultáveis por API) |
| Granularidade | município / mensal |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=cfurh"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset cfurh`
Destino: `data/raw/aneel/cfurh/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração e Transmissão]]
