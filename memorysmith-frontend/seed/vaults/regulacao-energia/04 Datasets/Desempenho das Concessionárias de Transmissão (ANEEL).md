---
title: Desempenho das Concessionárias de Transmissão (ANEEL)
aliases:
  - desempenho-das-concessionarias-de-transmissao
tags:
  - transmissao
  - parcela-variavel
  - indisponibilidade
  - dados-abertos
  - aneel
type: dataset
status: seed
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: ad-hoc
data_source: https://dadosabertos.aneel.gov.br/dataset/desempenho-das-concessionarias-de-transmissao
coverage: série histórica
---

> [!abstract]
> Valores deduzidos das receitas das concessionárias de transmissão por indisponibilidade decorrente de desligamentos intempestivos.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: série histórica · Cadência da fonte: ad hoc / conforme evento

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/desempenho-das-concessionarias-de-transmissao) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, XML, JSON |
| Recursos | 4 (0 no DataStore, consultáveis por API) |
| Granularidade | concessionária |
| Cadência declarada | ad hoc / conforme evento |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=desempenho-das-concessionarias-de-transmissao"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset desempenho-das-concessionarias-de-transmissao`
Destino: `data/raw/aneel/desempenho-das-concessionarias-de-transmissao/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Sem DataStore
> Nenhum recurso está publicado no DataStore — não há endpoint `datastore_search`. O acesso é por download do arquivo completo (ZIP/PARQUET).

## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração e Transmissão]]
