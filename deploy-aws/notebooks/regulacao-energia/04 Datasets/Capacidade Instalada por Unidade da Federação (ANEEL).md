---
title: Capacidade Instalada por Unidade da Federação (ANEEL)
aliases:
  - capacidade-instalada-por-unidade-da-federacao
tags:
  - capacidade-instalada
  - uf
  - serie
  - agregado
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
data_source: https://dadosabertos.aneel.gov.br/dataset/capacidade-instalada-por-unidade-da-federacao
coverage: a partir de 2006
---

> [!abstract]
> Quantidade de empreendimentos e potência instalada em operação por unidade da federação.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2006 · Cadência da fonte: trimestral

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/capacidade-instalada-por-unidade-da-federacao) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | UF / trimestral |
| Cadência declarada | trimestral |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=capacidade-instalada-por-unidade-da-federacao"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset capacidade-instalada-por-unidade-da-federacao`
Destino: `data/raw/aneel/capacidade-instalada-por-unidade-da-federacao/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração e Transmissão]]
