---
title: Indicadores de Qualidade do Atendimento Telefônico (ANEEL)
aliases:
  - indicadores-de-qualidade-do-atendimento-telefonico
tags:
  - qualidade
  - call-center
  - cta
  - atendimento
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
data_source: https://dadosabertos.aneel.gov.br/dataset/indicadores-de-qualidade-do-atendimento-telefonico
coverage: a partir de jan/2014
---

> [!abstract]
> Desempenho das Centrais de Teleatendimento das 40 distribuidoras com mais de 60 mil unidades consumidoras: INS, IAb, ICO, chamadas atendidas, abandonadas e não atendidas.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de jan/2014 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/indicadores-de-qualidade-do-atendimento-telefonico) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | distribuidora / mensal |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=indicadores-de-qualidade-do-atendimento-telefonico"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset indicadores-de-qualidade-do-atendimento-telefonico`
Destino: `data/raw/aneel/indicadores-de-qualidade-do-atendimento-telefonico/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `indicador-atendimento-telefonico.csv`  — 5.938 linhas

`resource_id`: `153c0076-28cf-45ac-bf6e-e9ac29b25d21`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=153c0076-28cf-45ac-bf6e-e9ac29b25d21&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `SigAgente / NumCNPJ / SigUF / NomRegiao` | text | Distribuidora e localização |
| `AnoReferencia / MesReferencia` | text | Competência |
| `PctINS / PctINSCheio / PctVariacaoINS` | text | Índice de Nível de Serviço — valor, valor cheio e variação |
| `PctIAb / PctIAbCheio / PctVariacaoIAb` | text | Índice de Abandono |
| `PctICO / PctICOCheio / PctVariacaoICO` | text | Índice de Chamadas Ocupadas |
| `QtdChoc / QtdChof (+ Cheio e Variação)` | text | Chamadas ocupadas e ofertadas |
| `QtdChamadasAtendidas / Abandonadas / NaoAtendidas (+ Cheio e Variação)` | text | Volumetria do call center |
| `DthCarga` | text | Data/hora da carga |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Qualidade do Serviço]] · Ref: [[Serviço Adequado (Distribuição)]]
