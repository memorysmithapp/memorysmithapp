---
title: TIPE - Termos de Intimação das Penas dos Editais (ANEEL)
aliases:
  - termos-de-intimacao-das-penas-dos-editais-tipe
tags:
  - fiscalizacao
  - leiloes
  - penalidade
  - editais
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
data_source: https://dadosabertos.aneel.gov.br/dataset/termos-de-intimacao-das-penas-dos-editais-tipe
coverage: série corrente
---

> [!abstract]
> Termos de intimação para aplicação das multas previstas nos editais de leilão de geração e transmissão, com um recurso por tipo de penalidade: advertência, inidoneidade, multa e suspensão.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: série corrente · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/termos-de-intimacao-das-penas-dos-editais-tipe) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 10 (5 no DataStore, consultáveis por API) |
| Granularidade | termo individual |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=termos-de-intimacao-das-penas-dos-editais-tipe"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset termos-de-intimacao-das-penas-dos-editais-tipe`
Destino: `data/raw/aneel/termos-de-intimacao-das-penas-dos-editais-tipe/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Fiscalização e Institucional]] · Ref: [[Garantia de Fiel Cumprimento]]
