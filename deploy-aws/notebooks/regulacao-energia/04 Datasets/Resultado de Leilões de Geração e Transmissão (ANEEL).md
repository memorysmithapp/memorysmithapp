---
title: Resultado de Leilões de Geração e Transmissão (ANEEL)
aliases:
  - resultado-de-leiloes
tags:
  - leiloes
  - contratacao
  - geracao
  - transmissao
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
data_source: https://dadosabertos.aneel.gov.br/dataset/resultado-de-leiloes
coverage: série histórica
---

> [!abstract]
> Resultados dos procedimentos licitatórios promovidos pela ANEEL por delegação do MME, para contratação de concessionárias de geração e transmissão.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: série histórica · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/resultado-de-leiloes) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 4 (2 no DataStore, consultáveis por API) |
| Granularidade | lote / empreendimento |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=resultado-de-leiloes"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset resultado-de-leiloes`
Destino: `data/raw/aneel/resultado-de-leiloes/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração e Transmissão]]
