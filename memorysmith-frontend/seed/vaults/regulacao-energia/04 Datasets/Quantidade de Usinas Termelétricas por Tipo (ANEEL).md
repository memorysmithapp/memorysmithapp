---
title: Quantidade de Usinas Termelétricas por Tipo (ANEEL)
aliases:
  - usinas-termeletricas-por-tipo
tags:
  - termeletrica
  - serie
  - agregado
  - dados-abertos
  - aneel
type: dataset
status: seed
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: quarterly
data_source: https://dadosabertos.aneel.gov.br/dataset/usinas-termeletricas-por-tipo
coverage: desde 2012
---

> [!abstract]
> Série agregada de quantidade e potência instalada de usinas termelétricas por tipo.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: desde 2012 · Cadência da fonte: trimestral

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/usinas-termeletricas-por-tipo) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | nacional / trimestral |
| Cadência declarada | trimestral |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=usinas-termeletricas-por-tipo"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset usinas-termeletricas-por-tipo`
Destino: `data/raw/aneel/usinas-termeletricas-por-tipo/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração e Transmissão]]
