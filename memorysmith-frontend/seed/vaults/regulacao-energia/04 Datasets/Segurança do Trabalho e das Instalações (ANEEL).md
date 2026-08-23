---
title: Segurança do Trabalho e das Instalações (ANEEL)
aliases:
  - seguranca-do-trabalho-e-das-instalacoes
tags:
  - seguranca
  - acidentes
  - prodist-6
  - dados-abertos
  - aneel
type: dataset
status: growing
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: monthly
data_source: https://dadosabertos.aneel.gov.br/dataset/seguranca-do-trabalho-e-das-instalacoes
coverage: conforme envio das distribuidoras
---

> [!abstract]
> Acidentes e fatalidades relacionados ao trabalho na distribuidora e às suas instalações, incluindo acidentes com a população em geral, taxas de frequência e gravidade e horas-homem de exposição ao risco.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: conforme envio das distribuidoras · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/seguranca-do-trabalho-e-das-instalacoes) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 3 (1 no DataStore, consultáveis por API) |
| Granularidade | distribuidora / mensal |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=seguranca-do-trabalho-e-das-instalacoes"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset seguranca-do-trabalho-e-das-instalacoes`
Destino: `data/raw/aneel/seguranca-do-trabalho-e-das-instalacoes/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `seguranca-trabalho-instalacoes.csv`  — 427.516 linhas

`resource_id`: `ebe17185-a400-4f7a-a680-87c7d67f43dc`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=ebe17185-a400-4f7a-a680-87c7d67f43dc&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `SigAgente / NumCNPJ` | text | Distribuidora |
| `SigIndicador` | text | NAC* acidentes, NMO* mortes, FQAC* taxa de frequência, GRVAC* taxa de gravidade, HHRISAC* horas-homem de exposição, DIADEB*/DIAPRD* dias debitados e perdidos — com sufixos Próprio/Terceiro, Típico/Trajeto |
| `AnoIndice / NumPeriodoIndice / VlrIndiceEnviado` | text | Ano, mês e valor |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Qualidade do Serviço]]
