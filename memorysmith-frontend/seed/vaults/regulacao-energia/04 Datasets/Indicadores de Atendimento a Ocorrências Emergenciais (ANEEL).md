---
title: Indicadores de Atendimento a Ocorrências Emergenciais (ANEEL)
aliases:
  - atendimento-ocorrencias-emergenciais
tags:
  - qualidade
  - emergencia
  - tmae
  - prodist-8
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
data_source: https://dadosabertos.aneel.gov.br/dataset/atendimento-ocorrencias-emergenciais
coverage: a partir de 2000
---

> [!abstract]
> TMP, TMD, TME, TMAE e PNIE por conjunto de unidades consumidoras — quanto tempo a distribuidora leva para preparar, deslocar e executar o atendimento de uma emergência.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2000 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/atendimento-ocorrencias-emergenciais) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, PARQUET |
| Recursos | 3 (1 no DataStore, consultáveis por API) |
| Granularidade | conjunto de unidades consumidoras / mensal |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=atendimento-ocorrencias-emergenciais"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset atendimento-ocorrencias-emergenciais`
Destino: `data/raw/aneel/atendimento-ocorrencias-emergenciais/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `indicador-atendimento-emergencial.csv`  — 1.212.500 linhas

`resource_id`: `73b00e68-66b1-4a72-8d72-b7baab47048c`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=73b00e68-66b1-4a72-8d72-b7baab47048c&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `SigAgente / NumCNPJ` | — | Distribuidora |
| `IdeConjUndConsumidoras / DscConjUndConsumidoras` | — | Conjunto de unidades consumidoras |
| `SigIndicador` | text | TMP, TMD, TME, TMAE, Nie, Pnie e as aberturas NAC*/NMO* por causa |
| `AnoIndice / NumPeriodoIndice` | numeric | Ano e mês |
| `VlrIndiceEnviado` | text | Valor em minutos ou quantidade, conforme o indicador |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Qualidade do Serviço]] · Ref: [[Serviço Adequado (Distribuição)]]
