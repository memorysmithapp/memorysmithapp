---
title: Empreendimento Hidrelétrico em Estudo (ANEEL)
aliases:
  - empreendimento-hidreletrico-em-estudo
tags:
  - hidreletrica
  - estudo
  - pre-outorga
  - dados-abertos
  - aneel
type: dataset
status: seed
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: monthly
data_source: https://dadosabertos.aneel.gov.br/dataset/empreendimento-hidreletrico-em-estudo
coverage: fases de pré-outorga
---

> [!abstract]
> Empreendimentos hidrelétricos em fase de estudo, antes da outorga, com localização georreferenciada.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: fases de pré-outorga · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/empreendimento-hidreletrico-em-estudo) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, XML |
| Recursos | 3 (1 no DataStore, consultáveis por API) |
| Granularidade | empreendimento / coordenadas |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=empreendimento-hidreletrico-em-estudo"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset empreendimento-hidreletrico-em-estudo`
Destino: `data/raw/aneel/empreendimento-hidreletrico-em-estudo/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração e Transmissão]]
