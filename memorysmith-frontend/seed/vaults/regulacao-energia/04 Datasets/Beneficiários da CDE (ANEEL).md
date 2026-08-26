---
title: Beneficiários da CDE (ANEEL)
aliases:
  - beneficiarios-da-cde
tags:
  - cde
  - subsidios
  - beneficiarios
  - baixa-renda
  - dados-abertos
  - aneel
type: dataset
maturity: seed
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: yearly
data_source: https://dadosabertos.aneel.gov.br/dataset/beneficiarios-da-cde
coverage: a partir de 2017
---

> [!abstract]
> Identificação dos beneficiários dos descontos tarifários custeados pela CDE, publicada por força do art. 24 do Decreto 9.022/2017. Um recurso por finalidade e por ano (rede básica, irrigação, baixa renda, rural etc.). É o conjunto com mais recursos do portal.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2017 · Cadência da fonte: anual

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/beneficiarios-da-cde) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, ZIP |
| Recursos | 110 (8 no DataStore, consultáveis por API) |
| Granularidade | município e distribuidora / mensal |
| Cadência declarada | anual |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=beneficiarios-da-cde"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset beneficiarios-da-cde`
Destino: `data/raw/aneel/beneficiarios-da-cde/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Tarifas e Encargos]] · Ref: [[Conta de Desenvolvimento Energético (CDE)]]
