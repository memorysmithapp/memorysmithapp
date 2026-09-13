---
title: IndQual - Inadimplência (ANEEL)
aliases:
  - indqual-inadimplencia
tags:
  - inadimplencia
  - aging
  - receita-faturada
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
data_source: https://dadosabertos.aneel.gov.br/dataset/indqual-inadimplencia
coverage: a partir de 2012
---

> [!abstract]
> Aging list da receita faturada não recebida, por classe de consumo e por janela de atraso (1, 3, 6, 12, 18, 21 e 24 meses), mais a quantidade de suspensões por inadimplemento. Base: art. 348 da REN 1.000/2021.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2012 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/indqual-inadimplencia) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 3 (1 no DataStore, consultáveis por API) |
| Granularidade | distribuidora / classe de consumo / mensal |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=indqual-inadimplencia"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset indqual-inadimplencia`
Destino: `data/raw/aneel/indqual-inadimplencia/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `inadimplencia.csv`  — 1.122.841 linhas

`resource_id`: `0bb73b5d-b2e1-417d-9873-6de6b2d397d1`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=0bb73b5d-b2e1-417d-9873-6de6b2d397d1&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `SigAgente / NumCNPJ` | text | Distribuidora |
| `SigIndicador` | text | Família `I<classe><janela>`: ITot1…ITot24, IResBR1…IResBR24, IRur*, IInd*, ICom*, IIPub*, IPPub*, ISerPub*, ICProp*, e sufixo `Crt` para créditos. Ex.: `IResBR12` = % da receita faturada no 12º mês anterior ainda não recebida, classe residencial baixa renda |
| `AnoIndice / NumPeriodoIndice` | text | Ano e mês |
| `VlrIndiceEnviado` | text | Percentual |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

- [[Evolução da Inadimplência Definitiva das Distribuidoras (2020–2025)]] — `series` · indicador `ITot24`
- [[Inadimplência alta e continuidade ruim andam juntas]] — `insight`

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Qualidade do Serviço]]
