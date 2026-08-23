---
title: Ouvidoria Setorial ANEEL
aliases:
  - ouvidoria-setorial-aneel
tags:
  - ouvidoria
  - reclamacoes
  - aneel
  - consumidor
  - dados-abertos
  - aneel
type: dataset
status: growing
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: daily
data_source: https://dadosabertos.aneel.gov.br/dataset/ouvidoria-setorial-aneel
coverage: a partir de 2014
---

> [!abstract]
> Reclamações que chegam à ANEEL quando o consumidor não resolve com a distribuidora, classificadas por categoria, subcategoria, tipologia e decisão. Um recurso por ano, de 2014 a 2026, com carga diária.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2014 · Cadência da fonte: diária

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/ouvidoria-setorial-aneel) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, PARQUET |
| Recursos | 19 (13 no DataStore, consultáveis por API) |
| Granularidade | município / diária |
| Cadência declarada | diária |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=ouvidoria-setorial-aneel"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset ouvidoria-setorial-aneel`
Destino: `data/raw/aneel/ouvidoria-setorial-aneel/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `ouvidoria-aneel-2026.csv (um recurso por ano, 2014–2026)`  — 230.746 linhas

`resource_id`: `1ee51181-9d1f-40f1-ae6e-61719d276b28`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=1ee51181-9d1f-40f1-ae6e-61719d276b28&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `SigAgente / NumCPFCNPJAgente` | text | Distribuidora reclamada |
| `SigUF / CodigoMunicipio / NomMunicipio` | text | Localização do consumidor |
| `NomCategoria / NomSubCategoria / NomTipologia` | text | Taxonomia da reclamação em três níveis |
| `NomDecisao / DscSituacao` | text | Decisão da ANEEL e situação do processo |
| `DtCriacao` | text | Data de criação — granularidade diária |
| `NumQtdReclamacoesDia` | text | Quantidade de reclamações no dia |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Qualidade do Serviço]]
