---
title: Composição Societária - Polímero (ANEEL)
aliases:
  - composicao-societaria-polimero
tags:
  - composicao-societaria
  - controle
  - ren-948
  - dados-abertos
  - aneel
type: dataset
maturity: seed
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: quarterly
data_source: https://dadosabertos.aneel.gov.br/dataset/composicao-societaria-polimero
coverage: a partir de dez/2020
---

> [!abstract]
> Cadeia societária dos empreendimentos do setor elétrico, declarada conforme a REN 948/2021. Permite rastrear controle e participação cruzada entre agentes.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de dez/2020 · Cadência da fonte: trimestral

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/composicao-societaria-polimero) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, PARQUET |
| Recursos | 3 (1 no DataStore, consultáveis por API) |
| Granularidade | empreendimento / sócio |
| Cadência declarada | trimestral |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=composicao-societaria-polimero"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset composicao-societaria-polimero`
Destino: `data/raw/aneel/composicao-societaria-polimero/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Mercado e Consumo]]
