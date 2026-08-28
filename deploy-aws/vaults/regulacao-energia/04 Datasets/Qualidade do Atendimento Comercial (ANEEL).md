---
title: Qualidade do Atendimento Comercial (ANEEL)
aliases:
  - qualidade-do-atendimento-comercial
tags:
  - qualidade
  - atendimento-comercial
  - prazos
  - ren-1000
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
data_source: https://dadosabertos.aneel.gov.br/dataset/qualidade-do-atendimento-comercial
coverage: a partir de 2011
---

> [!abstract]
> Cumprimento dos prazos de prestação dos serviços comerciais previstos na REN 1.000/2021: quantidade de serviços, prazo médio, transgressões e créditos pagos, por tipo de serviço.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2011 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/qualidade-do-atendimento-comercial) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 3 (2 no DataStore, consultáveis por API) |
| Granularidade | distribuidora até 2022, município depois |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=qualidade-do-atendimento-comercial"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset qualidade-do-atendimento-comercial`
Destino: `data/raw/aneel/qualidade-do-atendimento-comercial/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `qualidade-atendimento-comercial.csv`  — 1.492.242 linhas

`resource_id`: `11473878-1059-44f8-abf0-677212ff247b`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=11473878-1059-44f8-abf0-677212ff247b&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `SigAgente / NumCNPJ` | text | Distribuidora |
| `SigIndicador` | text | Trio por serviço: `QS*` quantidade, `PM*` prazo médio, `CR*` crédito por violação (ex.: QSLigBUb, PMLigBUb, CRLigBUb para ligação do grupo B em área urbana, art. 31 da REN 1.000/2021) |
| `AnoIndice / NumPeriodoIndice` | text | Ano e mês |
| `VlrIndiceEnviado` | text | Valor |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Qualidade do Serviço]] · Ref: [[Serviço Adequado (Distribuição)]]
