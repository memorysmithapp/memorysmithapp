---
title: Bandeiras Tarifárias (ANEEL)
aliases:
  - bandeiras-tarifarias
tags:
  - tarifas
  - bandeira-tarifaria
  - conta-bandeiras
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
data_source: https://dadosabertos.aneel.gov.br/dataset/bandeiras-tarifarias
coverage: a partir de jan/2015
---

> [!abstract]
> Três tabelas: o valor adicional de cada bandeira por resolução, o histórico mensal de acionamento, e a Conta Bandeiras por distribuidora — receita faturada, repasses, risco hidrológico e CVA.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de jan/2015 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/bandeiras-tarifarias) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 6 (3 no DataStore, consultáveis por API) |
| Granularidade | nacional (acionamento) / distribuidora (conta) |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=bandeiras-tarifarias"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset bandeiras-tarifarias`
Destino: `data/raw/aneel/bandeiras-tarifarias/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `bandeira-tarifaria-adicional.csv`  — 27 linhas

`resource_id`: `5879ca80-b3bd-45b1-a135-d9b77c1d5b36`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=5879ca80-b3bd-45b1-a135-d9b77c1d5b36&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `DatGeracaoConjuntoDados` | text | Data/hora da carga |
| `DscResolucao` | text | Resolução que fixou o adicional |
| `DatVigencia` | text | Início de vigência |
| `NomBandeiraAcionada` | text | Verde, Amarela, Vermelha P1, Vermelha P2, Escassez Hídrica |
| `VlrAdicionalBandeiraRSMWh` | text | Adicional em R$/MWh |

### `bandeira-tarifaria-acionamento.csv`  — 139 linhas

`resource_id`: `0591b8f6-fe54-437b-b72b-1aa2efd46e42`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=0591b8f6-fe54-437b-b72b-1aa2efd46e42&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `DatCompetencia` | text | Mês de competência — a série mensal de acionamento desde jan/2015 |
| `NomBandeiraAcionada` | text | Bandeira vigente no mês |
| `VlrAdicionalBandeira` | text | Adicional aplicado |

### `bandeira-tarifaria-conta-bandeira.csv`  — 13.540 linhas

`resource_id`: `e62b61dd-0a27-41b6-b1d2-19faa6c61501`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=e62b61dd-0a27-41b6-b1d2-19faa6c61501&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `SigAgente / NumCNPJDistribuidora` | text | Distribuidora |
| `DatCompetencia` | text | Mês de competência |
| `VlrReceitaFaturada` | text | Receita faturada com bandeira |
| `VlrRepasseContaBandeira` | text | Repasse à Conta Bandeiras |
| `VlrResultadoMCP / VlrCCEARD` | text | Resultado no MCP e custo dos CCEAR por disponibilidade |
| `VlrRiscoHidrologicoCCGF / …Itaipu / …Repactuadas / …CCGFRepactuadas` | text | Quatro aberturas do risco hidrológico |
| `VlrPrevisaoRiscoHidrologico / VlrPremioDeRisco` | text | Previsão e prêmio de risco |
| `VlrESSEER / VlrRessarcimentoCONER` | text | Encargo de serviço do sistema e ressarcimento |
| `VlrCVAEnergia* / VlrCVAESSEER* / VlrExposicaoInvolun*` | text | CVA e exposição involuntária: mês anterior, receita alocada e após repasse |
| `VlrAjusteRepasse` | text | Ajuste final do repasse |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Tarifas e Encargos]]
