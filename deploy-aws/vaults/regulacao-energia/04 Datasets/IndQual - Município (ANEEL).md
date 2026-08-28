---
title: IndQual - Município (ANEEL)
aliases:
  - indqual-municipio
tags:
  - chave
  - municipio
  - conjunto-uc
  - dimensao
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
data_source: https://dadosabertos.aneel.gov.br/dataset/indqual-municipio
coverage: a partir de 2001
---

> [!abstract]
> Tabela de ligação entre os conjuntos de unidades consumidoras e os municípios do IBGE. É a dimensão geográfica que permite espacializar todos os demais indicadores de qualidade.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2001 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/indqual-municipio) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | conjunto de UC ↔ município |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=indqual-municipio"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset indqual-municipio`
Destino: `data/raw/aneel/indqual-municipio/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `indqual-municipio.csv`  — 42.699 linhas

`resource_id`: `3f841488-80a8-42f2-a6ca-e0c593b228de`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=3f841488-80a8-42f2-a6ca-e0c593b228de&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `IdeConjUnidConsumidoras` | text | Conjunto de UC — chave de junção com DEC/FEC, emergenciais e nível de tensão |
| `CodMunicipio / NomMunicipio / SigUF` | text | Município do IBGE |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Qualidade do Serviço]]
