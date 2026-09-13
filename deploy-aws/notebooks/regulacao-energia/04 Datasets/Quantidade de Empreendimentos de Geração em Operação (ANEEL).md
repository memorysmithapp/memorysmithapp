---
title: Quantidade de Empreendimentos de Geração em Operação (ANEEL)
aliases:
  - empreendimentos-em-operacao
tags:
  - geracao
  - serie
  - potencia-instalada
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
data_source: https://dadosabertos.aneel.gov.br/dataset/empreendimentos-em-operacao
coverage: a partir de 2001
---

> [!abstract]
> Série agregada trimestral da quantidade de empreendimentos de geração em operação comercial e sua potência instalada. Derivado do SIGA.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2001 · Cadência da fonte: trimestral

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/empreendimentos-em-operacao) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | nacional / trimestral |
| Cadência declarada | trimestral |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=empreendimentos-em-operacao"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset empreendimentos-em-operacao`
Destino: `data/raw/aneel/empreendimentos-em-operacao/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração e Transmissão]]
