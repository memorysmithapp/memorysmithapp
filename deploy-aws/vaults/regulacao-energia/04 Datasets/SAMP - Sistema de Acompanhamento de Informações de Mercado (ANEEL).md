---
title: SAMP - Sistema de Acompanhamento de Informações de Mercado (ANEEL)
aliases:
  - samp
tags:
  - samp
  - mercado
  - consumo
  - ren-1003
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
data_source: https://dadosabertos.aneel.gov.br/dataset/samp
coverage: 2003 em diante
---

> [!abstract]
> Mercado de energia declarado pelas distribuidoras conforme a REN 1.003/2022: consumo e mercado por tipo, subgrupo, modalidade tarifária, classe, subclasse e posto tarifário. Um recurso por ano, de 2003 a 2026.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: 2003 em diante · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/samp) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, PARQUET |
| Recursos | 49 (24 no DataStore, consultáveis por API) |
| Granularidade | distribuidora / classe / competência mensal |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=samp"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset samp`
Destino: `data/raw/aneel/samp/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `samp-2026.csv (um recurso por ano, 2003–2026)`  — 643.982 linhas

`resource_id`: `56f1c242-5017-4cef-a365-0a96fffb0f2b`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=56f1c242-5017-4cef-a365-0a96fffb0f2b&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `NumCNPJAgenteDistribuidora / SigAgenteDistribuidora / NomAgenteDistribuidora` | numeric / text | Distribuidora |
| `NomTipoMercado` | text | Tipo de mercado (cativo, livre, suprimento…) |
| `DscModalidadeTarifaria / DscSubGrupoTarifario` | text | Enquadramento tarifário |
| `DscClasseConsumoMercado / DscSubClasseConsumidor / DscDetalheConsumidor` | text | Classe e subclasse |
| `IdeNucleoCeg` | numeric | Núcleo do CEG, quando o acessante é gerador |
| `NumCNPJAgenteAcessante / NomAgenteAcessante` | numeric / text | Acessante — permite isolar consumidores livres |
| `DscPostoTarifario / DscOpcaoEnergia / DscDetalheMercado` | text | Posto e opção de energia |
| `DatCompetencia` | timestamp | Competência mensal |
| `VlrMercado` | text | Valor do mercado — a métrica; unidade depende de DscDetalheMercado |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Mercado e Consumo]]
