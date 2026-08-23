---
title: PDD - Plano de Desenvolvimento da Distribuição (ANEEL)
aliases:
  - pdd
tags:
  - pdd
  - planejamento
  - investimento
  - expansao
  - dados-abertos
  - aneel
type: dataset
status: growing
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: yearly
data_source: https://dadosabertos.aneel.gov.br/dataset/pdd
coverage: por ano de referência
---

> [!abstract]
> Investimento planejado e realizado por distribuidora, tipo e classe de obra. É o único conjunto que confronta plano com execução na expansão da rede de distribuição.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: por ano de referência · Cadência da fonte: anual

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/pdd) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | distribuidora / UF / tipo de obra |
| Cadência declarada | anual |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=pdd"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset pdd`
Destino: `data/raw/aneel/pdd/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `pdd-distribuicao-aneel.csv`  — 5.484 linhas

`resource_id`: `30b8fbb7-4d7a-49d1-8985-97e9bb7d65e0`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=30b8fbb7-4d7a-49d1-8985-97e9bb7d65e0&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `SigAgente / NumCPFCNPJ` | text | Distribuidora |
| `DscTipoOutorga` | text | Concessão ou permissão |
| `SigUF / DscRegiao` | text | Localização |
| `AnoReferencia` | text | Ano do plano |
| `DscTipoObra / DscTipoObraClasse` | text | Tipo e classe da obra |
| `VlrTotalPlanejado` | text | Investimento planejado |
| `VlrTotalRealizado` | text | Investimento realizado — o par planejado × realizado é o que torna este conjunto interessante |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Distribuição e Rede]] · Ref: [[Plano de Resultados]]
