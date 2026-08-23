---
title: SCS - Sistema de Controle de Subvenções e Programas Sociais (ANEEL)
aliases:
  - scs-sistema-de-controle-de-subvencoes-e-programas-sociais
tags:
  - tarifa-social
  - baixa-renda
  - subvencao
  - dmr
  - dados-abertos
  - aneel
type: dataset
status: growing
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: monthly
data_source: https://dadosabertos.aneel.gov.br/dataset/scs-sistema-de-controle-de-subvencoes-e-programas-sociais
coverage: a partir de 2011
---

> [!abstract]
> Diferença Mensal de Receita (DMR) das distribuidoras referente aos descontos da Tarifa Social, com quantidade de consumidores e energia por faixa de benefício: baixa renda, indígena, quilombola, BPC e multifamiliar.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2011 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/scs-sistema-de-controle-de-subvencoes-e-programas-sociais) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | distribuidora / competência mensal |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=scs-sistema-de-controle-de-subvencoes-e-programas-sociais"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset scs-sistema-de-controle-de-subvencoes-e-programas-sociais`
Destino: `data/raw/aneel/scs-sistema-de-controle-de-subvencoes-e-programas-sociais/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `sistema-controle-subvencoes-programas-sociais.csv`  — 75.365 linhas

`resource_id`: `87764789-84c3-4592-a845-cb2b317f6142`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=87764789-84c3-4592-a845-cb2b317f6142&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `AnmMesAnoCompetencia` | text | Ano-mês de competência |
| `SigAgente / NumCNPJAgente` | text | Distribuidora |
| `AnmCompetenciaDespacho / NumDespacho / DatRegistro` | text | Despacho que aprovou a DMR |
| `IdcFaixa` | text | Faixa de consumo do benefício |
| `NumConsBaixaRenda / NumConsIndigena / NumConsQuilombola / NumConsBPC / NumConsMultifamiliar` | text | Consumidores por categoria de benefício |
| `MdaMWhBaixaRenda / …Indigena / …Quilombola / …BPC / …Multifamiliar` | text | Energia (MWh) por categoria |
| `VlrFatRealBaixaRenda / …Indigena / …Quilombola / …BPC / …Multifamiliar` | text | Faturamento por categoria |
| `QtdConsResTotal / MdaMWhConsResTotal / VlrFatRealTotal` | text | Totais residenciais — denominador para calcular penetração da TSEE |
| `VlrDMR / VlrCDE / VlrTarifa` | text | Diferença Mensal de Receita, aporte da CDE e tarifa de referência |
| `IdcSituacaoLote` | text | Situação do lote enviado |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Tarifas e Encargos]] · Ref: [[Conta de Desenvolvimento Energético (CDE)]]
