---
title: Atos de Outorgas de Geração (ANEEL)
aliases:
  - atos-de-outorgas-de-geracao
tags:
  - outorga
  - atos
  - geracao
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
data_source: https://dadosabertos.aneel.gov.br/dataset/atos-de-outorgas-de-geracao
coverage: a partir de 2015
---

> [!abstract]
> Documentos de outorga emitidos pela ANEEL para empreendimentos de geração desde 2015.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2015 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/atos-de-outorgas-de-geracao) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | ato administrativo |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=atos-de-outorgas-de-geracao"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset atos-de-outorgas-de-geracao`
Destino: `data/raw/aneel/atos-de-outorgas-de-geracao/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração e Transmissão]]
