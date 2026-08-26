---
title: Índice ANEEL de Satisfação do Consumidor - IASC (ANEEL)
aliases:
  - indice-aneel-de-satisfacao-do-consumidor-iasc
tags:
  - iasc
  - satisfacao
  - pesquisa
  - consumidor
  - dados-abertos
  - aneel
type: dataset
maturity: growing
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: yearly
data_source: https://dadosabertos.aneel.gov.br/dataset/indice-aneel-de-satisfacao-do-consumidor-iasc
coverage: a partir de 2006
---

> [!abstract]
> Resultado da pesquisa amostral anual de satisfação do consumidor residencial (cerca de 30 mil entrevistas), com os construtos do modelo — qualidade, satisfação, fidelidade, valor e confiança — seus pesos, médias, desvios e o perfil demográfico da amostra.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2006 · Cadência da fonte: anual

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/indice-aneel-de-satisfacao-do-consumidor-iasc) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | distribuidora / anual |
| Cadência declarada | anual |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=indice-aneel-de-satisfacao-do-consumidor-iasc"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset indice-aneel-de-satisfacao-do-consumidor-iasc`
Destino: `data/raw/aneel/indice-aneel-de-satisfacao-do-consumidor-iasc/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `indice-aneel-satisfacao-consumidor.csv`  — 1.493 linhas

`resource_id`: `7abd3a47-1e1a-4a33-933b-48d658a6f912`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=7abd3a47-1e1a-4a33-933b-48d658a6f912&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `NumAno / DscClassificacao / DescricaoCategoria` | text | Ano, classificação e categoria da distribuidora |
| `SigAgente / NumCNPJ / NumOrdemIASC` | text | Distribuidora e posição no ranking |
| `MdaIndicadorQualidade / Satisfacao / Fidelidade / Valor / Confianca` | text | Os cinco construtos do modelo IASC |
| `MdaSatisfacaoR2 / FidelidadeR2 / ValorR2 / ConfiancaR2` | text | R² de cada equação estrutural |
| `MdaPeso* (≈24 campos)` | text | Pesos das variáveis observadas em cada construto |
| `MdaMedia* / MdaDsvPad* (≈70 campos)` | text | Média e desvio padrão de cada variável do questionário (V8…V105) |
| `MdaCoeficiente* (7 campos)` | text | Coeficientes entre construtos (qualidade→valor, satisfação→fidelidade…) |
| `QtdSexo* / QtdFaixaEtaria* / QtdEscolaridade* / QtdRenda*` | text | Perfil demográfico da amostra |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Qualidade do Serviço]]
