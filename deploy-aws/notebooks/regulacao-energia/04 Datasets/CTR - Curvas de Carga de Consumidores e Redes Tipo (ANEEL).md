---
title: CTR - Curvas de Carga de Consumidores e Redes Tipo (ANEEL)
aliases:
  - ctr-curva-de-carga
tags:
  - tarifas
  - curva-de-carga
  - estrutura-tarifaria
  - revisao-tarifaria
  - dados-abertos
  - aneel
type: dataset
maturity: growing
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: ad-hoc
data_source: https://dadosabertos.aneel.gov.br/dataset/ctr-curva-de-carga
coverage: a partir de 2012
---

> [!abstract]
> Curvas de demanda dos consumidores tipo e das redes tipo, medidas nas campanhas das revisões tarifárias periódicas. É o insumo do cálculo de custos marginais e das tarifas de referência; atualiza conforme o calendário de RTP de cada distribuidora.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2012 · Cadência da fonte: ad hoc / conforme evento

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/ctr-curva-de-carga) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, PARQUET |
| Recursos | 6 (2 no DataStore, consultáveis por API) |
| Granularidade | curva horária por tipo de dia |
| Cadência declarada | ad hoc / conforme evento |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=ctr-curva-de-carga"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset ctr-curva-de-carga`
Destino: `data/raw/aneel/ctr-curva-de-carga/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `ctr-curvas-carga-consumidor-tipo.csv`  — 2.833.632 linhas

`resource_id`: `b0418edb-038d-4fde-b624-c318d376a734`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=b0418edb-038d-4fde-b624-c318d376a734&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `IdeCcs / SigCcs` | text | Identificação da campanha/concessionária |
| `AnoPrcCal / DscPrcCal` | text | Ano e processo de cálculo (a RTP de origem) |
| `NomSubGrupoTarifario` | text | Subgrupo do consumidor tipo |
| `DscDemandante` | text | Segmento demandante |
| `DscTipoDia` | text | Útil, sábado, domingo/feriado |
| `HorInicial / HorFinal` | text | Intervalo horário do patamar |
| `VlrDmd` | text | Demanda média no intervalo |

### `ctr-curvas-carga-redes-tipo.csv`  — 1.406.880 linhas

`resource_id`: `a77cacce-6a49-44c7-af20-508aecd4539d`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=a77cacce-6a49-44c7-af20-508aecd4539d&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `NomSbgOri / NomSbgDes` | text | Subgrupo de origem e de destino — é o que caracteriza a rede tipo |
| `demais campos` | — | Idênticos aos do consumidor tipo |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Tarifas e Encargos]]
