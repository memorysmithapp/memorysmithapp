---
title: BPR - Banco de Preços de Referência: Linha de Transmissão (ANEEL)
aliases:
  - bpr-banco-de-precos-de-referencia-linha-de-transmissao
tags:
  - bpr
  - precos
  - transmissao
  - base-de-remuneracao
  - dados-abertos
  - aneel
type: dataset
status: seed
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: monthly
data_source: https://dadosabertos.aneel.gov.br/dataset/bpr-banco-de-precos-de-referencia-linha-de-transmissao
coverage: versões sucessivas do banco
---

> [!abstract]
> Custos unitários de referência das unidades modulares de linhas de transmissão, usados no planejamento, na licitação de outorgas e na revisão das receitas permitidas.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: versões sucessivas do banco · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/bpr-banco-de-precos-de-referencia-linha-de-transmissao) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 50 (25 no DataStore, consultáveis por API) |
| Granularidade | unidade modular |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=bpr-banco-de-precos-de-referencia-linha-de-transmissao"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset bpr-banco-de-precos-de-referencia-linha-de-transmissao`
Destino: `data/raw/aneel/bpr-banco-de-precos-de-referencia-linha-de-transmissao/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração e Transmissão]]
