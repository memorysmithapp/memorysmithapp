---
title: Portal de Dados Abertos ANEEL (CKAN)
aliases:
  - dadosabertos.aneel.gov.br
  - CKAN ANEEL
  - Portal de Dados Abertos da ANEEL
tags:
  - aneel
  - dados-abertos
  - ckan
  - catalogo
  - fonte
type: dataset
status: growing
source: https://dadosabertos.aneel.gov.br/
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: weekly
data_source: https://dadosabertos.aneel.gov.br/api/3/action/package_search
coverage: 71 conjuntos de dados publicados em 2026-07-27
---

> [!abstract]
> Catálogo institucional de dados abertos da ANEEL, em CKAN 2.11.5. Reúne **71 conjuntos de dados** licenciados em ODbL, com API pública, DataStore consultável por SQL e resumos em PDF. É a fonte primária do eixo de dados do vault.

> [!info] Catalogado em 2026-07-27 · Cobertura: 71 conjuntos · Cadência: o catálogo muda por publicação; a maioria dos conjuntos é mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Endereço | https://dadosabertos.aneel.gov.br/ |
| Plataforma | CKAN 2.11.5 |
| Licença | Open Data Commons ODbL (67 dos 71 conjuntos) |
| Autenticação | Nenhuma — API pública, anônima |
| Conjuntos | 71 (11 marcados como descontinuados) |

### Distribuição por grupo temático

| Grupo | Conjuntos |
|---|---|
| Distribuição | 18 |
| Geração | 13 |
| Tarifas | 11 |
| Fiscalização | 10 |
| Transmissão | 5 |
| Outros assuntos | 5 |
| Eficiência Energética | 3 |
| Mercado | 3 |
| Pesquisa e Desenvolvimento | 3 |
| Geração Distribuída | 2 |

_Um conjunto pode pertencer a mais de um grupo; alguns não têm grupo atribuído._

### Formatos disponíveis

| Formato | Conjuntos que o oferecem |
|---|---|
| PDF (dicionário de dados) | 67 |
| CSV | 66 |
| XML | 19 |
| PARQUET | 16 |
| JSON | 13 |
| ZIP | 11 |

> [!tip] Prefira PARQUET quando existir
> Dezesseis conjuntos publicam versão Apache Parquet do mesmo conteúdo do CSV. Para os conjuntos grandes — reclamações (6,0 milhões de linhas), CTR (2,8 milhões), DEC/FEC (2,8 milhões), nível de tensão (1,8 milhão) — a diferença de tempo de leitura é substancial.

## Como obter

Três caminhos, em ordem de preferência:

### 1. API do catálogo (metadados)

```bash
# lista completa de conjuntos com recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_search?rows=200"

# um conjunto específico
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=<slug>"
```

### 2. DataStore (dados, sem baixar arquivo)

Recursos com `datastore_active: true` respondem a consulta direta — inclusive SQL:

```bash
# schema e contagem de linhas, sem trazer dado
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=<id>&limit=0"

# consulta SQL
curl -s --get "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search_sql" \
  --data-urlencode 'sql=SELECT "SigAgente", COUNT(*) FROM "<resource_id>" GROUP BY 1'
```

### 3. Download direto do recurso

```
https://dadosabertos.aneel.gov.br/dataset/<pkg_id>/resource/<res_id>/download/<arquivo>
```

Rotina reexecutável: `data/scripts/aneel_ckan.py`

## Ressalvas do dado

> [!important] Tipagem: quase tudo é `text`
> O DataStore expõe a maioria dos campos numéricos e de data como `text`. Isso vale inclusive para valores monetários e potências. Casting explícito é obrigatório — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].

> [!warning] `coverage` é declarado, não verificado
> A cobertura temporal de cada conjunto vem do campo *Cobertura temporal* preenchido pela ANEEL no catálogo. Não há garantia de que o arquivo publicado hoje cubra de fato toda a janela declarada. A conferência é parte da primeira coleta de cada conjunto.

> [!warning] Onze conjuntos descontinuados
> Onze conjuntos ainda aparecem no catálogo mas não recebem dado novo — a maioria substituída por um sucessor indicado na própria descrição. Estão fichados e marcados, mas não devem sustentar conclusão sobre o presente.

> [!question] Cadência declarada × cadência real
> Vários conjuntos declaram cadência diária ou semanal. Não foi verificado se o `metadata_modified` acompanha essa promessa. Verificar na primeira rodada de atualização e registrar aqui a divergência, se houver.

## Derivados

As 71 fichas de conjunto em `knowledge-vault/03 Datasets/` — inventário em [[Catálogo de Dados Abertos ANEEL]].

## Fontes irmãs

- [[Repositório Público GitLab ANEEL]] — documentos, normas versionadas e planilhas de trabalho
- [[Portal Geoespacial ANEEL (ArcGIS Open Data)]] — BDGD e camadas georreferenciadas

---

Fonte: ANEEL · MOC: [[Dados - Índice Geral]]
