---
title: Subsídios Tarifários (ANEEL)
aliases:
  - subsidios-tarifarios
tags:
  - tarifas
  - subsidios
  - cde
  - dados-abertos
  - aneel
type: dataset
maturity: growing
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: monthly
data_source: https://dadosabertos.aneel.gov.br/dataset/subsidios-tarifarios
coverage: a partir de fev/2013
---

> [!abstract]
> Valores de subsídio tarifário por agente e por tipo, com o ato normativo que os concedeu e sua vigência. Cobre o período em que os descontos passaram a ser custeados pela CDE em vez de subsídio cruzado local.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de fev/2013 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/subsidios-tarifarios) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | agente / tipo de subsídio / mês |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=subsidios-tarifarios"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset subsidios-tarifarios`
Destino: `data/raw/aneel/subsidios-tarifarios/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `subsidios-tarifarios.csv`  — 226.904 linhas

`resource_id`: `325c828c-1cde-485e-9571-a412fa64f768`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=325c828c-1cde-485e-9571-a412fa64f768&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `DatSubsidio` | text | Mês do subsídio |
| `NumCPFCNPJ / SigAgente / NomAgente` | text | Agente beneficiário |
| `DscTipoMontante` | text | Tipo de montante subsidiado |
| `DscTipoSubsidio` | text | Finalidade do subsídio (irrigação, rural, GD, baixa renda…) |
| `VlrSubsidio` | text | Valor — texto |
| `DscAtoNormativo / NumAto / DatAssinaturaAto` | text | Ato que concedeu o subsídio |
| `DatInicioVigenciaAto / DatFimVigenciaAto / DthPublicacaoAto` | text | Vigência e publicação do ato |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Tarifas e Encargos]] · Ref: [[Conta de Desenvolvimento Energético (CDE)]]
