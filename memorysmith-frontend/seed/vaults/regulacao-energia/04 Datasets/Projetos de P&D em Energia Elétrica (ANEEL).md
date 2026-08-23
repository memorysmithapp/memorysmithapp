---
title: Projetos de P&D em Energia Elétrica (ANEEL)
aliases:
  - projetos-de-p-d-em-energia-eletrica
tags:
  - p-e-d
  - inovacao
  - projetos
  - dados-abertos
  - aneel
type: dataset
status: seed
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: monthly
data_source: https://dadosabertos.aneel.gov.br/dataset/projetos-de-p-d-em-energia-eletrica
coverage: 2008 em diante
---

> [!abstract]
> Projetos do Programa de P&D do setor elétrico, com tema, agente executor e valores.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: 2008 em diante · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/projetos-de-p-d-em-energia-eletrica) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | projeto |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=projetos-de-p-d-em-energia-eletrica"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset projetos-de-p-d-em-energia-eletrica`
Destino: `data/raw/aneel/projetos-de-p-d-em-energia-eletrica/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Fiscalização e Institucional]]
