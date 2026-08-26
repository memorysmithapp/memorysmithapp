---
title: Acréscimo Anual da Potência Instalada (ANEEL)
aliases:
  - acrescimo-da-potencia-instalada
tags:
  - potencia-instalada
  - expansao
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
refresh_frequency: yearly
data_source: https://dadosabertos.aneel.gov.br/dataset/acrescimo-da-potencia-instalada
coverage: a partir de 1999
---

> [!abstract]
> Saldo anual de potência instalada — o que entrou menos o que saiu de operação. Derivado do SIGA e da liberação para operação comercial.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 1999 · Cadência da fonte: anual

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/acrescimo-da-potencia-instalada) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | nacional / anual |
| Cadência declarada | anual |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=acrescimo-da-potencia-instalada"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset acrescimo-da-potencia-instalada`
Destino: `data/raw/aneel/acrescimo-da-potencia-instalada/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração e Transmissão]]
