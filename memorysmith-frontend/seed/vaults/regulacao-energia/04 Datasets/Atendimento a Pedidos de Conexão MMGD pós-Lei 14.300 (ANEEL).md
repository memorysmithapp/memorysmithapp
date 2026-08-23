---
title: Atendimento a Pedidos de Conexão MMGD pós-Lei 14.300 (ANEEL)
aliases:
  - atendimento-mmgd-mini-e-micro-geracao-distribuida
tags:
  - geracao-distribuida
  - mmgd
  - conexao
  - lei-14300
  - dados-abertos
  - aneel
type: dataset
status: seed
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: monthly
data_source: https://dadosabertos.aneel.gov.br/dataset/atendimento-mmgd-mini-e-micro-geracao-distribuida
coverage: 07/01/2022 a 07/01/2023, com atualizações posteriores
---

> [!abstract]
> Pedidos de conexão de MMGD recebidos pelas distribuidoras, solicitados pelo Ofício Circular 5/2023-SFE/SRD/SMA para acompanhar o atendimento das solicitações feitas na janela da Lei 14.300/2022. Arquivos particionados por região geográfica.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: 07/01/2022 a 07/01/2023, com atualizações posteriores · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/atendimento-mmgd-mini-e-micro-geracao-distribuida) |
| Licença | Open Data Commons ODbL |
| Formatos | ZIP, PARQUET |
| Recursos | 11 (0 no DataStore, consultáveis por API) |
| Granularidade | pedido de conexão / região |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=atendimento-mmgd-mini-e-micro-geracao-distribuida"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset atendimento-mmgd-mini-e-micro-geracao-distribuida`
Destino: `data/raw/aneel/atendimento-mmgd-mini-e-micro-geracao-distribuida/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Ressalvas do dado

> [!warning] Ficha construída a partir do catálogo, não do arquivo
> Cobertura, granularidade e cadência são as **declaradas pela ANEEL** no CKAN — não foram verificadas contra o dado baixado. Nenhum valor numérico foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Sem DataStore
> Nenhum recurso está publicado no DataStore — não há endpoint `datastore_search`. O acesso é por download do arquivo completo (ZIP/PARQUET).

## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração Distribuída]] · Ref: [[Solicitação de Acesso para Micro e Minigeração Distribuída]], [[Parecer de Acesso]], [[Regra de Transição do Fio B]]
