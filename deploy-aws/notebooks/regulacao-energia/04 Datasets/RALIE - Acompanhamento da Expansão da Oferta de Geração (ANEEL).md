---
title: RALIE - Acompanhamento da Expansão da Oferta de Geração (ANEEL)
aliases:
  - ralie-relatorio-de-acompanhamento-da-expansao-da-oferta-de-geracao-de-energia-eletrica
tags:
  - ralie
  - expansao
  - obras
  - fiscalizacao
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
data_source: https://dadosabertos.aneel.gov.br/dataset/ralie-relatorio-de-acompanhamento-da-expansao-da-oferta-de-geracao-de-energia-eletrica
coverage: a partir de 2021
---

> [!abstract]
> Acompanhamento quinzenal das obras de todos os empreendimentos de geração em implantação: cronograma, atos administrativos e situação de campo.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2021 · Cadência da fonte: ad hoc / conforme evento

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/ralie-relatorio-de-acompanhamento-da-expansao-da-oferta-de-geracao-de-energia-eletrica) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, ZIP, PARQUET |
| Recursos | 12 (3 no DataStore, consultáveis por API) |
| Granularidade | empreendimento em implantação |
| Cadência declarada | ad hoc / conforme evento |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=ralie-relatorio-de-acompanhamento-da-expansao-da-oferta-de-geracao-de-energia-eletrica"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset ralie-relatorio-de-acompanhamento-da-expansao-da-oferta-de-geracao-de-energia-eletrica`
Destino: `data/raw/aneel/ralie-relatorio-de-acompanhamento-da-expansao-da-oferta-de-geracao-de-energia-eletrica/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração e Transmissão]]
