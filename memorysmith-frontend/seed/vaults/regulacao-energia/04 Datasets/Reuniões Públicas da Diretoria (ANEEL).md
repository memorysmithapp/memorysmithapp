---
title: Reuniões Públicas da Diretoria (ANEEL)
aliases:
  - reunioes-publicas-da-diretoria
tags:
  - diretoria
  - governanca
  - reunioes
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
data_source: https://dadosabertos.aneel.gov.br/dataset/reunioes-publicas-da-diretoria
coverage: set/2017 em diante
---

> [!abstract]
> Quantidade de reuniões públicas ordinárias e extraordinárias da Diretoria Colegiada por período.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: set/2017 em diante · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/reunioes-publicas-da-diretoria) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, XML, JSON |
| Recursos | 4 (1 no DataStore, consultáveis por API) |
| Granularidade | reunião / diária |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=reunioes-publicas-da-diretoria"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset reunioes-publicas-da-diretoria`
Destino: `data/raw/aneel/reunioes-publicas-da-diretoria/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Fiscalização e Institucional]]
