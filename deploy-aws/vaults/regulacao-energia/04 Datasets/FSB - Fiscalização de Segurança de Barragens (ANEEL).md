---
title: FSB - Fiscalização de Segurança de Barragens (ANEEL)
aliases:
  - fsb-fiscalizacao-de-seguranca-de-barragens
tags:
  - barragens
  - seguranca
  - fiscalizacao
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
data_source: https://dadosabertos.aneel.gov.br/dataset/fsb-fiscalizacao-de-seguranca-de-barragens
coverage: a partir de 2016
---

> [!abstract]
> Classificação de risco e dano potencial associado das barragens de usinas hidrelétricas fiscalizadas pela ANEEL, conforme a Lei 12.334/2010 e a REN 696/2015.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2016 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/fsb-fiscalizacao-de-seguranca-de-barragens) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | barragem / coordenadas / anual |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=fsb-fiscalizacao-de-seguranca-de-barragens"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset fsb-fiscalizacao-de-seguranca-de-barragens`
Destino: `data/raw/aneel/fsb-fiscalizacao-de-seguranca-de-barragens/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração e Transmissão]]
