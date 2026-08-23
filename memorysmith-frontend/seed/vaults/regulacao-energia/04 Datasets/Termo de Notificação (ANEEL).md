---
title: Termo de Notificação (ANEEL)
aliases:
  - termo-de-notificacao
tags:
  - fiscalizacao
  - notificacao
  - ren-846
  - dados-abertos
  - aneel
type: dataset
status: seed
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: monthly
data_source: https://dadosabertos.aneel.gov.br/dataset/termo-de-notificacao
coverage: a partir de mai/2018
---

> [!abstract]
> Termos de Notificação emitidos nas ações de fiscalização — o passo anterior ao Auto de Infração.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de mai/2018 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/termo-de-notificacao) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, XML |
| Recursos | 3 (1 no DataStore, consultáveis por API) |
| Granularidade | termo individual |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=termo-de-notificacao"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset termo-de-notificacao`
Destino: `data/raw/aneel/termo-de-notificacao/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!success] Conjunto coletado em 2026-07-27
> Baixado por `data/scripts/coleta_qualidade_fiscalizacao.py` para `data/raw/aneel/`, com manifesto e SHA-256. Os derivados abaixo saíram deste arquivo, não do catálogo.

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.



## Derivados no `context-vault/`

- [[Autos de Infração e Multas Aplicados a Distribuidoras]] — `indicator` · o termo é o passo anterior ao auto

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Fiscalização e Institucional]]
