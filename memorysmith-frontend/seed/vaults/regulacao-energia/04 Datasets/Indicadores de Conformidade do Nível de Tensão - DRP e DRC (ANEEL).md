---
title: Indicadores de Conformidade do Nível de Tensão - DRP e DRC (ANEEL)
aliases:
  - indicadores-de-conformidade-do-nivel-de-tensao-em-regime-permanente
tags:
  - qualidade
  - drp
  - drc
  - tensao
  - prodist-8
  - dados-abertos
  - aneel
type: dataset
status: growing
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: monthly
data_source: https://dadosabertos.aneel.gov.br/dataset/indicadores-de-conformidade-do-nivel-de-tensao-em-regime-permanente
coverage: a partir de 2012
---

> [!abstract]
> DRP e DRC — o percentual do tempo em que a unidade consumidora fica com tensão precária ou crítica — apurados por amostragem, mais as compensações pagas por atendimento fora dos limites.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2012 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/indicadores-de-conformidade-do-nivel-de-tensao-em-regime-permanente) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 5 (2 no DataStore, consultáveis por API) |
| Granularidade | distribuidora e conjunto / trimestral |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=indicadores-de-conformidade-do-nivel-de-tensao-em-regime-permanente"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset indicadores-de-conformidade-do-nivel-de-tensao-em-regime-permanente`
Destino: `data/raw/aneel/indicadores-de-conformidade-do-nivel-de-tensao-em-regime-permanente/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `indicadores-conformidade-nivel-tensao.csv`  — 84.500 linhas

`resource_id`: `b6755d51-f537-4e0f-8fd8-d2cead66178a`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=b6755d51-f537-4e0f-8fd8-d2cead66178a&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `SigAgente / NumCNPJ` | — | Distribuidora |
| `CodUndCnmSrt` | numeric | Unidade consumidora sorteada para a amostra |
| `SigIndicador` | text | DRP, DRC, DRPt, DRCt, ICC… |
| `AnoIndice / NumPeriodoIndice` | numeric | Ano e trimestre |
| `VlrIndiceEnviado` | text | Valor apurado |

### `indicadores-compensacao-nivel-tensao.csv`  — 1.784.934 linhas

`resource_id`: `476d0490-a225-4de7-89a8-bb7a189f0868`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=476d0490-a225-4de7-89a8-bb7a189f0868&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `IdeConjUndConsumidoras / DscConjUndConsumidoras` | — | Conjunto de UC |
| `SigIndicador` | text | COMPCONF e variantes — compensação por tensão fora do limite |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Qualidade do Serviço]] · Ref: [[Serviço Adequado (Distribuição)]]
