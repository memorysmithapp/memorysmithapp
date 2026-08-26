---
title: Agentes de Geração de Energia Elétrica (ANEEL)
aliases:
  - agentes-de-geracao-de-energia-eletrica
tags:
  - geracao
  - agentes
  - ceg
  - participacao
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
data_source: https://dadosabertos.aneel.gov.br/dataset/agentes-de-geracao-de-energia-eletrica
coverage: cadastro corrente
---

> [!abstract]
> Vínculo entre usinas (CEG) e seus proprietários, com percentual de participação e regime de exploração.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: cadastro corrente · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/agentes-de-geracao-de-energia-eletrica) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | usina / agente |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=agentes-de-geracao-de-energia-eletrica"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset agentes-de-geracao-de-energia-eletrica`
Destino: `data/raw/aneel/agentes-de-geracao-de-energia-eletrica/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração e Transmissão]]
