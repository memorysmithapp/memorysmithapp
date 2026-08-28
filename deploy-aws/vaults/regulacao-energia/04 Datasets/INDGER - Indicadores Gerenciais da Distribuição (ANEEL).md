---
title: INDGER - Indicadores Gerenciais da Distribuição (ANEEL)
aliases:
  - indger-indicadores-gerenciais-da-distribuicao
tags:
  - indger
  - distribuicao
  - alimentadores
  - faturamento
  - ativos
  - dados-abertos
  - aneel
type: dataset
maturity: growing
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: monthly
data_source: https://dadosabertos.aneel.gov.br/dataset/indger-indicadores-gerenciais-da-distribuicao
coverage: a partir de 2023
---

> [!abstract]
> Quatro visões gerenciais de todas as distribuidoras: dados comerciais (faturamento, refaturamento, ressarcimento de danos, suspensões), serviços comerciais, e dados técnicos de alimentadores e de linhas de distribuição — inspeções, manutenções e carregamento máximo.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2023 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/indger-indicadores-gerenciais-da-distribuicao) |
| Licença | Open Data Commons ODbL |
| Formatos | ZIP, PARQUET, CSV |
| Recursos | 13 (4 no DataStore, consultáveis por API) |
| Granularidade | município, alimentador e linha de distribuição |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=indger-indicadores-gerenciais-da-distribuicao"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset indger-indicadores-gerenciais-da-distribuicao`
Destino: `data/raw/aneel/indger-indicadores-gerenciais-da-distribuicao/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `indger-dados-comerciais.csv`  — 255.290 linhas

`resource_id`: `fd10c9d4-cb76-4020-a322-e79afb13eaf7`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=fd10c9d4-cb76-4020-a322-e79afb13eaf7&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `NumCNPJ / SigAgente / NomAgente / NomTipoOutorga` | text | Distribuidora |
| `DatReferenciaInformada` | text | Competência |
| `CodMunicipioIBGE` | text | Município — granularidade municipal |
| `QtdUCAtiva / QtdUCAtivaFat` | text | Unidades consumidoras ativas e faturadas |
| `QtdFatura* (≈16 campos)` | text | Faturas emitidas, com e sem leitura, por motivo (impedimento de acesso, emergência, plurimensal, estimada, fim de contrato, ausência de TM) |
| `QtdFaturaAcerto* (6 campos)` | text | Faturas de acerto por tipo de devolução (dobro, SEC, SET) |
| `QtdRest* / VlrRest* (8 campos)` | text | Restituições antecipadas, atrasadas e pendentes |
| `QtdSolicRessarcimentoDano / QtdRessarcIndeferido / VlrPagoRessarcDano` | text | Ressarcimento de danos elétricos |
| `QtdPostoAtendimento / QtdAtendRealizPosto / MdaTempoMedAtendimentoPosto` | text | Atendimento presencial e tempo de espera |
| `QtdInspecVerifProcIrregular / QtdTermosOcorrInspecao*` | text | Inspeções por irregularidade — proxy de perdas não técnicas |
| `QtdUCSuspInadimplemento / QtdSuspIndev / VlrTotCompSuspIndevida` | text | Suspensões por inadimplemento e compensações por suspensão indevida |

### `indger-dados-tecnicos-alimentadores.csv`  — 1.350.634 linhas

`resource_id`: `a19a3bee-2554-4d70-b031-a7eb4875ce42`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=a19a3bee-2554-4d70-b031-a7eb4875ce42&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `CodConjuntoUC / CodAlimentador` | text | Conjunto e alimentador — a granularidade mais fina de ativo no CKAN |
| `QtdConsAtivo / QtdRec1N2001` | text | Consumidores ativos e reclamações de 1º nível |
| `NumMes/AnoUltInspecao, …ManutencaoPrev, …ManutencaoCorr` | text | Data da última inspeção e das manutenções preventiva e corretiva |
| `PctCarregamentoMaxAlimentador` | text | Carregamento máximo — indicador de saturação da rede |

### `indger-dados-tecnicos-linhas-distribuicao.csv`  — 309.346 linhas

`resource_id`: `515d8462-6c58-4727-afc3-dbad332fa231`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=515d8462-6c58-4727-afc3-dbad332fa231&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `CodConjuntoUC / CodLinhaDistribuicao` | text | Conjunto e linha de distribuição |
| `NumMes/AnoUltInspecaoLD, …InspecaoTermoLD, …ManutPrevLD, …ManutCorrLD` | text | Inspeção visual, termográfica e manutenções |
| `PctCarregamentoMax` | text | Carregamento máximo da linha |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

- [[Suspensão Indevida do Fornecimento]] — `indicator` · cortes indevidos, compensação e ressarcimento por dano

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Distribuição e Rede]] · Ref: [[Serviço Adequado (Distribuição)]], [[Área de Elevada Complexidade ao Combate às Perdas]]
