---
title: Tarifa Social de Energia Elétrica - Beneficiários (descontinuado)
aliases:
  - tarifa-social-de-energia-eletrica-beneficiarios
tags:
  - descontinuado
  - tarifa-social
  - baixa-renda
  - dados-abertos
  - aneel
type: dataset
status: seed
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: ad-hoc
data_source: https://dadosabertos.aneel.gov.br/dataset/tarifa-social-de-energia-eletrica-beneficiarios
coverage: histórico
---

> [!abstract]
> Histórico da quantidade de unidades consumidoras residenciais baixa renda. Substituído por Beneficiários da CDE.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: histórico · Cadência da fonte: ad hoc / conforme evento

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/tarifa-social-de-energia-eletrica-beneficiarios) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, XML, JSON |
| Recursos | 4 (0 no DataStore, consultáveis por API) |
| Granularidade | distribuidora |
| Cadência declarada | ad hoc / conforme evento |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=tarifa-social-de-energia-eletrica-beneficiarios"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset tarifa-social-de-energia-eletrica-beneficiarios`
Destino: `data/raw/aneel/tarifa-social-de-energia-eletrica-beneficiarios/<AAAA-MM-DD>/`

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
