---
title: Tarifas de Aplicação das Distribuidoras (ANEEL)
aliases:
  - tarifas-distribuidoras-energia-eletrica
tags:
  - tarifas
  - tusd
  - te
  - distribuidora
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
data_source: https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica
coverage: 2010 em diante
---

> [!abstract]
> Tarifas homologadas de TUSD e TE por distribuidora, resultantes dos processos de reajuste e revisão tarifária, abertas por base tarifária, subgrupo, modalidade, classe, subclasse e posto tarifário.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: 2010 em diante · Cadência da fonte: semanal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV, XML |
| Recursos | 3 (1 no DataStore, consultáveis por API) |
| Granularidade | distribuidora / subgrupo / modalidade / classe |
| Cadência declarada | semanal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=tarifas-distribuidoras-energia-eletrica"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset tarifas-distribuidoras-energia-eletrica`
Destino: `data/raw/aneel/tarifas-distribuidoras-energia-eletrica/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `tarifas-homologadas-distribuidoras-energia-eletrica.csv`  — 321.749 linhas

`resource_id`: `fcf2906c-7c32-4b9b-a637-054e7a5234f4`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=fcf2906c-7c32-4b9b-a637-054e7a5234f4&limit=5
```

| Campo                     | Tipo | Descrição                                                         |
| ------------------------- | ---- | ----------------------------------------------------------------- |
| `DatGeracaoConjuntoDados` | text | Data/hora da carga que gerou a publicação                         |
| `DscREH`                  | text | Resolução Homologatória que fixou a tarifa                        |
| `SigAgente`               | text | Sigla da distribuidora                                            |
| `NumCNPJDistribuidora`    | text | CNPJ da distribuidora — chave de junção com o cadastro de agentes |
| `DatInicioVigencia`       | text | Início da vigência da tarifa                                      |
| `DatFimVigencia`          | text | Fim da vigência da tarifa                                         |
| `DscBaseTarifaria`        | text | Base tarifária (ex.: Tarifa de Aplicação, Base Econômica)         |
| `DscSubGrupo`             | text | Subgrupo tarifário (A1…A4, AS, B1…B4)                             |
| `DscModalidadeTarifaria`  | text | Convencional, Horária Azul, Horária Verde, Branca…                |
| `DscClasse`               | text | Classe de consumo                                                 |
| `DscSubClasse`            | text | Subclasse de consumo                                              |
| `DscDetalhe`              | text | Detalhamento adicional do enquadramento                           |
| `NomPostoTarifario`       | text | Ponta, Fora Ponta, Intermediário, Não se aplica                   |
| `DscUnidadeTerciaria`     | text | Unidade do valor (R$/MWh ou R$/kW)                                |
| `SigAgenteAcessante`      | text | Agente acessante, quando a tarifa é específica                    |
| `VlrTUSD`                 | text | Valor da TUSD — **texto**, exige conversão                        |
| `VlrTE`                   | text | Valor da TE — **texto**, exige conversão                          |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Tarifas e Encargos]] · Ref: [[Separação Tarifária e Contábil]]
