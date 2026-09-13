---
title: Custeio dos Benefícios Tarifários pela CDE (ANEEL)
aliases:
  - conta-desenvolvimento-energetico-cde-custeio-dos-beneficios-tarifarios
tags:
  - cde
  - subsidios
  - custeio
  - dados-abertos
  - aneel
type: dataset
maturity: growing
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: yearly
data_source: https://dadosabertos.aneel.gov.br/dataset/conta-desenvolvimento-energetico-cde-custeio-dos-beneficios-tarifarios
coverage: por ano de referência
---

> [!abstract]
> O lado da fonte: quanto cada tipo de recurso aporta para custear os benefícios tarifários da CDE, por ano de referência.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: por ano de referência · Cadência da fonte: anual

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/conta-desenvolvimento-energetico-cde-custeio-dos-beneficios-tarifarios) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | fonte de custeio / ano |
| Cadência declarada | anual |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=conta-desenvolvimento-energetico-cde-custeio-dos-beneficios-tarifarios"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset conta-desenvolvimento-energetico-cde-custeio-dos-beneficios-tarifarios`
Destino: `data/raw/aneel/conta-desenvolvimento-energetico-cde-custeio-dos-beneficios-tarifarios/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `cde-custeio-beneficios-tarifarios.csv`  — 373 linhas

`resource_id`: `90430056-d594-4f42-8b89-6c15839e5377`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=90430056-d594-4f42-8b89-6c15839e5377&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `AnoReferencia` | text | Ano de referência |
| `DscTipoFonte` | text | Tipo de fonte de custeio |
| `DscFonte` | text | Fonte específica (quotas, RGR, multas, União…) |
| `VlrCusteio` | text | Valor aportado |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Tarifas e Encargos]] · Ref: [[Conta de Desenvolvimento Energético (CDE)]]
