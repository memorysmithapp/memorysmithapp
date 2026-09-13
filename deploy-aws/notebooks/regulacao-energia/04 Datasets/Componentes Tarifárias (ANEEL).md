---
title: Componentes Tarifárias (ANEEL)
aliases:
  - componentes-tarifarias
tags:
  - tarifas
  - componentes-tarifarias
  - tusd
  - te
  - dados-abertos
  - aneel
type: dataset
maturity: growing
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: weekly
data_source: https://dadosabertos.aneel.gov.br/dataset/componentes-tarifarias
coverage: 2010 em diante
---

> [!abstract]
> Abertura das tarifas homologadas nos seus componentes (encargos, transporte, perdas, energia). Um recurso por ano de vigência, de 2012 a 2026 — é a visão decomposta do que o conjunto de Tarifas de Aplicação entrega agregado.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: 2010 em diante · Cadência da fonte: semanal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/componentes-tarifarias) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, PARQUET |
| Recursos | 31 (15 no DataStore, consultáveis por API) |
| Granularidade | distribuidora / componente / ano |
| Cadência declarada | semanal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=componentes-tarifarias"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset componentes-tarifarias`
Destino: `data/raw/aneel/componentes-tarifarias/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `componentes-tarifarias-2026.csv (um recurso por ano, 2012–2026)`  — 621.396 linhas

`resource_id`: `e8717aa8-2521-453f-bf16-fbb9a16eea39`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=e8717aa8-2521-453f-bf16-fbb9a16eea39&limit=5
```

| Campo                                                                 | Tipo | Descrição                                                                          |
| --------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------- |
| `DatGeracaoConjuntoDados`                                             | text | Data/hora da carga                                                                 |
| `DscResolucaoHomologatoria`                                           | text | REH que fixou o componente                                                         |
| `SigNomeAgente`                                                       | text | Sigla da distribuidora                                                             |
| `NumCPFCNPJ`                                                          | text | CNPJ da distribuidora                                                              |
| `DatInicioVigencia / DatFimVigencia`                                  | text | Janela de vigência                                                                 |
| `DscBaseTarifaria`                                                    | text | Base tarifária                                                                     |
| `DscSubGrupoTarifario`                                                | text | Subgrupo (A1…B4)                                                                   |
| `DscModalidadeTarifaria`                                              | text | Modalidade tarifária                                                               |
| `DscClasseConsumidor / DscSubClasseConsumidor / DscDetalheConsumidor` | text | Enquadramento do consumidor                                                        |
| `DscPostoTarifario`                                                   | text | Posto tarifário                                                                    |
| `DscUnidade`                                                          | text | Unidade do valor                                                                   |
| `SigNomeAgenteAcessante`                                              | text | Agente acessante                                                                   |
| `DscComponenteTarifario`                                              | text | **Componente** — é o campo que diferencia este conjunto do de Tarifas de Aplicação |
| `VlrComponenteTarifario`                                              | text | Valor do componente — texto                                                        |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Tarifas e Encargos]] · Ref: [[Conta de Desenvolvimento Energético (CDE)]]
