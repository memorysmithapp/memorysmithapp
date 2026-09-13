---
title: Termo de Intimação - TI (ANEEL)
aliases:
  - termo-de-intimacao-ti
tags:
  - fiscalizacao
  - intimacao
  - caducidade
  - ren-846
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
data_source: https://dadosabertos.aneel.gov.br/dataset/termo-de-intimacao-ti
coverage: a partir de mai/2018
---

> [!abstract]
> Termos de Intimação com as penas mais graves da REN 846/2019: revogação de autorização, intervenção, suspensão de participação em licitações e caducidade da concessão.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de mai/2018 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/termo-de-intimacao-ti) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | termo individual |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=termo-de-intimacao-ti"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset termo-de-intimacao-ti`
Destino: `data/raw/aneel/termo-de-intimacao-ti/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Fiscalização e Institucional]] · Ref: [[Caducidade da Concessão de Distribuição]]
