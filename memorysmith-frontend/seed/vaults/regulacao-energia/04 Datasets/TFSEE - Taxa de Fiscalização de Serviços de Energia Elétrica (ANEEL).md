---
title: TFSEE - Taxa de Fiscalização de Serviços de Energia Elétrica (ANEEL)
aliases:
  - tfsee
tags:
  - tfsee
  - tributo
  - fiscalizacao
  - proret
  - dados-abertos
  - aneel
type: dataset
status: seed
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: daily
data_source: https://dadosabertos.aneel.gov.br/dataset/tfsee
coverage: série corrente
---

> [!abstract]
> Valores anuais de TFSEE devidos por cada agente do setor — 0,4% do benefício econômico anual, conforme a Lei 9.427/1996 e o Submódulo 5.5 do PRORET.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: série corrente · Cadência da fonte: diária

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/tfsee) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | agente / anual |
| Cadência declarada | diária |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=tfsee"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset tfsee`
Destino: `data/raw/aneel/tfsee/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Fiscalização e Institucional]]
