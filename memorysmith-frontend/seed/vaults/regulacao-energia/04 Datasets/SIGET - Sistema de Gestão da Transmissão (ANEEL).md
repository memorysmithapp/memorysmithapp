---
title: SIGET - Sistema de Gestão da Transmissão (ANEEL)
aliases:
  - sistema-de-gestao-da-transmissao-siget
tags:
  - siget
  - transmissao
  - outorga
  - rap
  - dados-abertos
  - aneel
type: dataset
maturity: seed
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: daily
data_source: https://dadosabertos.aneel.gov.br/dataset/sistema-de-gestao-da-transmissao-siget
coverage: a partir de 2005
---

> [!abstract]
> Cadastro e acompanhamento das outorgas de transmissão: contratos, instalações, receitas anuais permitidas e situação das obras da rede básica.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2005 · Cadência da fonte: diária

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/sistema-de-gestao-da-transmissao-siget) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 34 (17 no DataStore, consultáveis por API) |
| Granularidade | instalação / contrato de concessão |
| Cadência declarada | diária |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=sistema-de-gestao-da-transmissao-siget"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset sistema-de-gestao-da-transmissao-siget`
Destino: `data/raw/aneel/sistema-de-gestao-da-transmissao-siget/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração e Transmissão]]
