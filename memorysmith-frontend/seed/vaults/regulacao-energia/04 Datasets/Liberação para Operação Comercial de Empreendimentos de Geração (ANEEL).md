---
title: Liberação para Operação Comercial de Empreendimentos de Geração (ANEEL)
aliases:
  - liberacao-para-operacao-comercial-de-empreendimentos-de-geracao
tags:
  - operacao-comercial
  - potencia
  - expansao
  - dados-abertos
  - aneel
type: dataset
status: seed
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: ad-hoc
data_source: https://dadosabertos.aneel.gov.br/dataset/liberacao-para-operacao-comercial-de-empreendimentos-de-geracao
coverage: 1997 em diante
---

> [!abstract]
> Potência liberada para operação comercial, em versão detalhada por usina e resumida por ano e tipo de geração. Marca o momento em que a capacidade instalada efetivamente entra no sistema.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: 1997 em diante · Cadência da fonte: ad hoc / conforme evento

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/liberacao-para-operacao-comercial-de-empreendimentos-de-geracao) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, XML |
| Recursos | 6 (2 no DataStore, consultáveis por API) |
| Granularidade | unidade geradora / anual |
| Cadência declarada | ad hoc / conforme evento |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=liberacao-para-operacao-comercial-de-empreendimentos-de-geracao"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset liberacao-para-operacao-comercial-de-empreendimentos-de-geracao`
Destino: `data/raw/aneel/liberacao-para-operacao-comercial-de-empreendimentos-de-geracao/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração e Transmissão]]
