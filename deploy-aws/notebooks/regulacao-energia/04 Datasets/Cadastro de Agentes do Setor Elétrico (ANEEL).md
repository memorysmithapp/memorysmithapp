---
title: Cadastro de Agentes do Setor Elétrico (ANEEL)
aliases:
  - agentes-do-setor-eletrico
tags:
  - agentes
  - cadastro
  - cnpj
  - dimensao
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
data_source: https://dadosabertos.aneel.gov.br/dataset/agentes-do-setor-eletrico
coverage: cadastro corrente
---

> [!abstract]
> Cadastro oficial de pessoas físicas e jurídicas de interesse da ANEEL, com indicadores booleanos de atuação em geração, transmissão, distribuição e comercialização. É a dimensão de agente que amarra quase todos os demais conjuntos pelo CNPJ.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: cadastro corrente · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/agentes-do-setor-eletrico) |
| Licença | Open Data Commons ODbL |
| Formatos | CSV |
| Recursos | 2 (1 no DataStore, consultáveis por API) |
| Granularidade | pessoa física ou jurídica |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=agentes-do-setor-eletrico"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset agentes-do-setor-eletrico`
Destino: `data/raw/aneel/agentes-do-setor-eletrico/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `agentes-setor-eletrico.csv`  — 9.927 linhas

`resource_id`: `64250fc9-4f7a-4d97-b0d4-3c090e005e1c`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=64250fc9-4f7a-4d97-b0d4-3c090e005e1c&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `NumCnpj` | text | CNPJ — **a chave de junção do ecossistema** |
| `SigPessoa / NomRazaoSocial` | text | Sigla e razão social |
| `IdcAtivo` | text | Agente ativo |
| `IdcGeracao / IdcTransmissao / IdcDistribuicao / IdcComercializacao` | text | Flags de atuação por segmento |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Fiscalização e Institucional]]
