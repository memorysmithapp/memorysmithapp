---
title: GCEM - Campos Elétricos e Magnéticos (ANEEL)
aliases:
  - gcem-gestao-de-informacoes-de-campos-eletromagneticos
tags:
  - cem
  - seguranca
  - linhas
  - subestacoes
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
data_source: https://dadosabertos.aneel.gov.br/dataset/gcem-gestao-de-informacoes-de-campos-eletromagneticos
coverage: a partir de 2010
---

> [!abstract]
> Medições de campos elétricos e magnéticos em linhas de transmissão e subestações, enviadas pelos agentes conforme a REN 915/2021 e a Lei 11.934/2009.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2010 · Cadência da fonte: ad hoc / conforme evento

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/gcem-gestao-de-informacoes-de-campos-eletromagneticos) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 4 (2 no DataStore, consultáveis por API) |
| Granularidade | linha de transmissão e subestação |
| Cadência declarada | ad hoc / conforme evento |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=gcem-gestao-de-informacoes-de-campos-eletromagneticos"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset gcem-gestao-de-informacoes-de-campos-eletromagneticos`
Destino: `data/raw/aneel/gcem-gestao-de-informacoes-de-campos-eletromagneticos/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Distribuição e Rede]]
