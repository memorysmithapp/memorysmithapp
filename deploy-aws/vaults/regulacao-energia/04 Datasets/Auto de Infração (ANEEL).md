---
title: Auto de Infração (ANEEL)
aliases:
  - auto-de-infracao
tags:
  - fiscalizacao
  - auto-de-infracao
  - penalidade
  - ren-846
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
data_source: https://dadosabertos.aneel.gov.br/dataset/auto-de-infracao
coverage: a partir de mai/2018
---

> [!abstract]
> Autos de infração lavrados pela ANEEL e pelas agências estaduais conveniadas, com as penas de advertência, multa, embargo e interdição da REN 846/2019. Complementa o Termo de Notificação.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de mai/2018 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/auto-de-infracao) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, XML |
| Recursos | 3 (1 no DataStore, consultáveis por API) |
| Granularidade | auto individual |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=auto-de-infracao"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset auto-de-infracao`
Destino: `data/raw/aneel/auto-de-infracao/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!success] Conjunto coletado em 2026-07-27
> Baixado por `data/scripts/coleta_qualidade_fiscalizacao.py` para `data/raw/aneel/`, com manifesto e SHA-256. Os derivados abaixo saíram deste arquivo, não do catálogo.

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

- [[Autos de Infração e Multas Aplicados a Distribuidoras]] — `indicator` · autos e multas por natureza
- [[Evolução da Compensação por Continuidade e das Multas (2020–2025)]] — `series`
- [[A transgressão do limite coletivo não tem consequência financeira direta]] — `insight`

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Fiscalização e Institucional]]
