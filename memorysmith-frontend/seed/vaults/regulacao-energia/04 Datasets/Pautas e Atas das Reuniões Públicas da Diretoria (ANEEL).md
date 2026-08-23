---
title: Pautas e Atas das Reuniões Públicas da Diretoria (ANEEL)
aliases:
  - pautas-e-atas-das-reunioes-publicas-da-diretoria
tags:
  - diretoria
  - atas
  - pautas
  - deliberacao
  - dados-abertos
  - aneel
type: dataset
status: seed
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: weekly
data_source: https://dadosabertos.aneel.gov.br/dataset/pautas-e-atas-das-reunioes-publicas-da-diretoria
coverage: a partir de set/2017
---

> [!abstract]
> Pautas e atas das reuniões públicas da Diretoria — o registro do que foi deliberado e quando.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de set/2017 · Cadência da fonte: semanal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/pautas-e-atas-das-reunioes-publicas-da-diretoria) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | reunião |
| Cadência declarada | semanal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=pautas-e-atas-das-reunioes-publicas-da-diretoria"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset pautas-e-atas-das-reunioes-publicas-da-diretoria`
Destino: `data/raw/aneel/pautas-e-atas-das-reunioes-publicas-da-diretoria/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Fiscalização e Institucional]]
