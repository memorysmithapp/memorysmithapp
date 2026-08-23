---
title: Base de Dados Geográfica da Distribuidora - BDGD (ANEEL)
aliases:
  - base-de-dados-geografica-da-distribuidora-bdgd
tags:
  - bdgd
  - geoespacial
  - sig-r
  - prodist-10
  - ativos
  - dados-abertos
  - aneel
type: dataset
status: growing
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: yearly
data_source: https://dadosabertos.aneel.gov.br/dataset/base-de-dados-geografica-da-distribuidora-bdgd
coverage: envio anual das distribuidoras
---

> [!abstract]
> Modelo geográfico do sistema elétrico real de cada distribuidora — ativos, topologia da rede e atributos técnicos e comerciais — padronizado pelo Módulo 10 do PRODIST. Os Geodatabases ficam no portal ArcGIS da ANEEL; no CKAN há apenas os extratos de unidades consumidoras PJ por nível de tensão.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: envio anual das distribuidoras · Cadência da fonte: anual

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/base-de-dados-geografica-da-distribuidora-bdgd) |
| Licença | Open Data Commons ODbL |
| Formatos | Geodatabase (ArcGIS), CSV, ZIP |
| Recursos | 6 (0 no DataStore, consultáveis por API) |
| Granularidade | ativo elétrico georreferenciado |
| Cadência declarada | anual |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=base-de-dados-geografica-da-distribuidora-bdgd"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset base-de-dados-geografica-da-distribuidora-bdgd`
Destino: `data/raw/aneel/base-de-dados-geografica-da-distribuidora-bdgd/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `Geodatabases por distribuidora — portal ArcGIS`

| Campo | Tipo | Descrição |
|---|---|---|
| `Entidades geográficas` | — | Segmentos de rede (SSDMT/SSDBT), unidades transformadoras (UNTRMT/UNTRAT), unidades consumidoras (UCAT/UCMT/UCBT), conjuntos, subestações, alimentadores |
| `Entidades não geográficas` | — | Curvas de carga, medições, energia mensal por UC, base de ativos |
| `Padrão` | — | Definido no **Módulo 10 do PRODIST** — o manual de instruções e o próprio módulo estão publicados como recursos do conjunto |

### `ucat_pj.csv / ucmt_pj.csv / ucbt_pj.zip — no CKAN`

`resource_id`: `4318d38a-0bcd-421d-afb1-fb88b0c92a87`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=4318d38a-0bcd-421d-afb1-fb88b0c92a87&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `—` | — | Extratos de unidades consumidoras de pessoa jurídica por nível de tensão (alta, média, baixa). É a única fatia da BDGD disponível diretamente no CKAN |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].

> [!important] Sem DataStore
> Nenhum recurso está publicado no DataStore — não há endpoint `datastore_search`. O acesso é por download do arquivo completo (ZIP/PARQUET).

## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Distribuição e Rede]] · Ref: [[Serviço Adequado (Distribuição)]], [[Compartilhamento de Infraestrutura de Postes]]
