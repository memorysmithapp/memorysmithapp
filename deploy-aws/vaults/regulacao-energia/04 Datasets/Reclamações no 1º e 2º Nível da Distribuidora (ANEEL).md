---
title: Reclamações no 1º e 2º Nível da Distribuidora (ANEEL)
aliases:
  - reclamacoes-no-1o-e-2o-niveis-da-distribuidora
tags:
  - reclamacoes
  - ouvidoria
  - atendimento
  - consumidor
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
data_source: https://dadosabertos.aneel.gov.br/dataset/reclamacoes-no-1o-e-2o-niveis-da-distribuidora
coverage: a partir de jan/2010
---

> [!abstract]
> Reclamações dos consumidores junto à própria distribuidora, por tipologia, canal e procedência, no atendimento de 1º nível (SAC) e 2º nível (Ouvidoria da distribuidora), com prazo médio de solução.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de jan/2010 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/reclamacoes-no-1o-e-2o-niveis-da-distribuidora) |
| Licença | Open Data Commons ODbL |
| Formatos | ZIP, PARQUET |
| Recursos | 10 (2 no DataStore, consultáveis por API) |
| Granularidade | município desde 2023 / mensal |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=reclamacoes-no-1o-e-2o-niveis-da-distribuidora"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset reclamacoes-no-1o-e-2o-niveis-da-distribuidora`
Destino: `data/raw/aneel/reclamacoes-no-1o-e-2o-niveis-da-distribuidora/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `reclamacoes-n1e2-distribuidoras-2023.zip (um recurso por ano)`  — 6.044.391 linhas

`resource_id`: `426f4fb2-6a89-452a-8236-cc48153ee607`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=426f4fb2-6a89-452a-8236-cc48153ee607&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `DatReferencia` | text | Mês de referência |
| `SigAgente / NumCPFCNPJ / NomClassificacaoAgente` | text | Distribuidora |
| `CodMunicipio / NomMunicipio / SigUF / SigRegiao` | text | Município — granularidade municipal a partir de 2023 |
| `CodTipoReclamacao / DescReclamacao` | text | Tipologia da reclamação |
| `NomCanalReclamacao / DscFormaContato` | text | Canal e forma de contato |
| `QtdReclamacoesRecebidas / Procedentes / Improcedentes` | text | Volumetria e procedência |
| `NumPrazoMedioSolucao` | text | Prazo médio de solução |
| `NumOuvPrazoMedioSolucaoImproc / NumSacPrazoMedioSolucaoImproc` | text | Prazo médio das improcedentes, por nível (Ouvidoria e SAC) |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Qualidade do Serviço]]
