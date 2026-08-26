---
title: BPR - Banco de Preços de Referência: Subestação (ANEEL)
aliases:
  - bpr-banco-de-precos-de-referencia-subestacao
tags:
  - bpr
  - precos
  - subestacao
  - base-de-remuneracao
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
data_source: https://dadosabertos.aneel.gov.br/dataset/bpr-banco-de-precos-de-referencia-subestacao
coverage: versões sucessivas do banco
---

> [!abstract]
> Custos unitários de referência das unidades modulares de subestações, usados na apuração da base de remuneração regulatória.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: versões sucessivas do banco · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/bpr-banco-de-precos-de-referencia-subestacao) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 8 (4 no DataStore, consultáveis por API) |
| Granularidade | unidade modular |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=bpr-banco-de-precos-de-referencia-subestacao"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset bpr-banco-de-precos-de-referencia-subestacao`
Destino: `data/raw/aneel/bpr-banco-de-precos-de-referencia-subestacao/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração e Transmissão]]
