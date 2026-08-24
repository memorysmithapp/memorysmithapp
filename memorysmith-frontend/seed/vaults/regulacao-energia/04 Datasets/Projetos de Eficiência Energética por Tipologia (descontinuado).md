---
title: Projetos de Eficiência Energética por Tipologia (descontinuado)
aliases:
  - projetos-por-tipologia
tags:
  - descontinuado
  - eficiencia-energetica
  - dados-abertos
  - aneel
type: dataset
maturity: seed
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: ad-hoc
data_source: https://dadosabertos.aneel.gov.br/dataset/projetos-por-tipologia
coverage: histórico
---

> [!abstract]
> Quantidade acumulada de projetos e demanda retirada de ponta. Substituído por Projetos de Eficiência Energética.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: histórico · Cadência da fonte: ad hoc / conforme evento

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/projetos-por-tipologia) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, XML, JSON |
| Recursos | 4 (0 no DataStore, consultáveis por API) |
| Granularidade | tipologia |
| Cadência declarada | ad hoc / conforme evento |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=projetos-por-tipologia"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset projetos-por-tipologia`
Destino: `data/raw/aneel/projetos-por-tipologia/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!warning] Conjunto descontinuado
> A ANEEL marcou este conjunto como descontinuado. Serve para série histórica; não recebe dado novo.

## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Catálogo de Dados Abertos ANEEL]]
