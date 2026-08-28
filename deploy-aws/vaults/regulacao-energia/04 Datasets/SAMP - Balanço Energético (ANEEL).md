---
title: SAMP - Balanço Energético (ANEEL)
aliases:
  - samp-balanco
tags:
  - samp
  - balanco-energetico
  - perdas
  - mercado
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
data_source: https://dadosabertos.aneel.gov.br/dataset/samp-balanco
coverage: a partir de 2003
---

> [!abstract]
> Balanço energético das distribuidoras — disponibilidades e requisitos de energia — conforme os Submódulos 2.6 e 2.6A do PRORET. É a base para apuração de perdas técnicas e não técnicas.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2003 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/samp-balanco) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, PARQUET |
| Recursos | 3 (1 no DataStore, consultáveis por API) |
| Granularidade | distribuidora / competência mensal |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=samp-balanco"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset samp-balanco`
Destino: `data/raw/aneel/samp-balanco/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `samp-balanco.csv`  — 545.340 linhas

`resource_id`: `9f03a034-fb01-4daa-b6a6-e25a84d979ed`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=9f03a034-fb01-4daa-b6a6-e25a84d979ed&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `NumCPFCNPJ / NomAgente` | text | Distribuidora |
| `AnmCompetenciaBalanco / AnoReferenciaBalanco / MesReferenciaBalanco` | text | Competência |
| `DscModalidadeBalanco` | text | Modalidade do balanço |
| `DscFluxoEnergia` | text | **Disponibilidade ou requisito** — o eixo que fecha o balanço |
| `DscCctBalanco / DscDetalheBalanco` | text | Conceito e detalhe da linha do balanço |
| `DscClassificacaoAgente` | text | Classificação do agente |
| `VlrEnergia` | text | Energia — texto |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Mercado e Consumo]] · Ref: [[Área de Elevada Complexidade ao Combate às Perdas]]
