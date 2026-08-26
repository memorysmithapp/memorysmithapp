---
title: Interrupções de Energia Elétrica nas Redes de Distribuição (ANEEL)
aliases:
  - interrupcoes-de-energia-eletrica-nas-redes-de-distribuicao
tags:
  - qualidade
  - interrupcoes
  - continuidade
  - microdados
  - dados-abertos
  - aneel
type: dataset
maturity: seed
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: monthly
data_source: https://dadosabertos.aneel.gov.br/dataset/interrupcoes-de-energia-eletrica-nas-redes-de-distribuicao
coverage: a partir de 2017
---

> [!abstract]
> Microdados de cada interrupção ocorrida nas redes de distribuição, com marcação temporal ao segundo, um recurso por ano. É a matéria-prima de onde DEC, FEC, DIC, FIC e DMIC são derivados.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2017 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/interrupcoes-de-energia-eletrica-nas-redes-de-distribuicao) |
| Licença | Open Data Commons ODbL |
| Formatos | ZIP, PARQUET |
| Recursos | 16 (0 no DataStore, consultáveis por API) |
| Granularidade | interrupção individual, marcada ao segundo |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=interrupcoes-de-energia-eletrica-nas-redes-de-distribuicao"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset interrupcoes-de-energia-eletrica-nas-redes-de-distribuicao`
Destino: `data/raw/aneel/interrupcoes-de-energia-eletrica-nas-redes-de-distribuicao/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Sem DataStore
> Nenhum recurso está publicado no DataStore — não há endpoint `datastore_search`. O acesso é por download do arquivo completo (ZIP/PARQUET).

## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Qualidade do Serviço]] · Ref: [[Serviço Adequado (Distribuição)]]
