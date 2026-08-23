---
title: Audiências e Consultas Públicas (ANEEL)
aliases:
  - audiencias-e-consultas-publicas
tags:
  - consulta-publica
  - audiencia-publica
  - participacao
  - dados-abertos
  - aneel
type: dataset
status: seed
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: quarterly
data_source: https://dadosabertos.aneel.gov.br/dataset/audiencias-e-consultas-publicas
coverage: a partir de 2013
---

> [!abstract]
> Consultas públicas, audiências públicas e tomadas de subsídios promovidas pela ANEEL. É o rastro do processo de construção normativa.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2013 · Cadência da fonte: trimestral

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/audiencias-e-consultas-publicas) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | processo participativo |
| Cadência declarada | trimestral |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=audiencias-e-consultas-publicas"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset audiencias-e-consultas-publicas`
Destino: `data/raw/aneel/audiencias-e-consultas-publicas/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Fiscalização e Institucional]] · Ref: [[Rede Nacional dos Consumidores de Energia Elétrica (Renacon)]]
