---
title: SLC - Sistema de Licitações e Contratos da ANEEL
aliases:
  - slc-sistema-de-licitacoes-e-contratos
tags:
  - contratos
  - licitacao
  - administrativo
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
data_source: https://dadosabertos.aneel.gov.br/dataset/slc-sistema-de-licitacoes-e-contratos
coverage: até 2020
---

> [!abstract]
> Contratações administrativas da própria ANEEL desde 2004. Sem atualização: para contratos a partir de 2020, a fonte é o Comprasnet.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: até 2020 · Cadência da fonte: ad hoc / conforme evento

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/slc-sistema-de-licitacoes-e-contratos) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | contrato |
| Cadência declarada | ad hoc / conforme evento |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=slc-sistema-de-licitacoes-e-contratos"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset slc-sistema-de-licitacoes-e-contratos`
Destino: `data/raw/aneel/slc-sistema-de-licitacoes-e-contratos/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Fiscalização e Institucional]]
