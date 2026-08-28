---
title: SIGA - Sistema de Informações de Geração (ANEEL)
aliases:
  - siga-sistema-de-informacoes-de-geracao-da-aneel
tags:
  - siga
  - geracao
  - empreendimentos
  - ceg
  - outorga
  - dados-abertos
  - aneel
type: dataset
maturity: growing
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: daily
data_source: https://dadosabertos.aneel.gov.br/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel
coverage: cadastro corrente
---

> [!abstract]
> Cadastro de todos os empreendimentos de geração do parque nacional, da pré-outorga à revogação: CEG, fase, fonte, tipo de outorga, potência outorgada e fiscalizada, garantia física, coordenadas e municípios. Há versão mensal e versão diária.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: cadastro corrente · Cadência da fonte: diária

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, XML |
| Recursos | 5 (2 no DataStore, consultáveis por API) |
| Granularidade | empreendimento de geração |
| Cadência declarada | diária |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=siga-sistema-de-informacoes-de-geracao-da-aneel"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset siga-sistema-de-informacoes-de-geracao-da-aneel`
Destino: `data/raw/aneel/siga-sistema-de-informacoes-de-geracao-da-aneel/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `siga-empreendimentos-geracao.csv (há também versão diária)`  — 25.218 linhas

`resource_id`: `11ec447d-698d-4ab8-977f-b424d5deee6a`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=11ec447d-698d-4ab8-977f-b424d5deee6a&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `NomEmpreendimento` | text | Nome da usina |
| `CodCEG / IdeNucleoCEG` | text | Código Único de Empreendimento de Geração — chave canônica do parque gerador |
| `SigUFPrincipal / DscMuninicpios / DscSubBacia` | text | Localização (o nome do campo de municípios traz erro de grafia na origem) |
| `SigTipoGeracao` | text | UHE, PCH, CGH, UTE, UTN, UFV, EOL, CGU |
| `DscFaseUsina` | text | Fase: outorga, construção, operação, revogada… |
| `DscOrigemCombustivel / DscFonteCombustivel / NomFonteCombustivel` | text | Fonte energética em três níveis |
| `DscTipoOutorga / DatInicioVigencia / DatFimVigencia` | text | Regime e vigência da outorga |
| `DatEntradaOperacao` | text | Entrada em operação |
| `MdaPotenciaOutorgadaKw / MdaPotenciaFiscalizadaKw / MdaGarantiaFisicaKw` | text | Potência outorgada, fiscalizada e garantia física |
| `IdcGeracaoQualificada` | text | Geração qualificada |
| `NumCoordNEmpreendimento / NumCoordEEmpreendimento` | text | Coordenadas geográficas |
| `DscPropriRegimePariticipacao` | text | Regime de participação (grafia da origem) |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração e Transmissão]]
