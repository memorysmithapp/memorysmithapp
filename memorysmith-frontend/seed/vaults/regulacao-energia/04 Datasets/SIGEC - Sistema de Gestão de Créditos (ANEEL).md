---
title: SIGEC - Sistema de Gestão de Créditos (ANEEL)
aliases:
  - sigec-sistema-de-gestao-de-creditos
tags:
  - sigec
  - arrecadacao
  - multas
  - tfsee
  - ubp
  - dados-abertos
  - aneel
type: dataset
status: seed
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: daily
data_source: https://dadosabertos.aneel.gov.br/dataset/sigec-sistema-de-gestao-de-creditos
coverage: a partir de 1998
---

> [!abstract]
> Créditos arrecadados pela ANEEL: multas de autos de infração, TFSEE, Uso de Bem Público e demais receitas, com situação de cobrança.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 1998 · Cadência da fonte: diária

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/sigec-sistema-de-gestao-de-creditos) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, PARQUET |
| Recursos | 5 (2 no DataStore, consultáveis por API) |
| Granularidade | crédito individual |
| Cadência declarada | diária |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=sigec-sistema-de-gestao-de-creditos"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset sigec-sistema-de-gestao-de-creditos`
Destino: `data/raw/aneel/sigec-sistema-de-gestao-de-creditos/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Fiscalização e Institucional]]
