---
title: Indicadores Coletivos de Continuidade DEC e FEC (ANEEL)
aliases:
  - indicadores-coletivos-de-continuidade-dec-e-fec
tags:
  - qualidade
  - dec
  - fec
  - continuidade
  - prodist-8
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
data_source: https://dadosabertos.aneel.gov.br/dataset/indicadores-coletivos-de-continuidade-dec-e-fec
coverage: a partir de 2000
---

> [!abstract]
> Valores apurados e limites de DEC e FEC por conjunto de unidades consumidoras, mais as compensações pagas por transgressão e os atributos físico-elétricos de cada conjunto. É o núcleo do eixo de qualidade do serviço.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de 2000 · Cadência da fonte: mensal

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/indicadores-coletivos-de-continuidade-dec-e-fec) |
| Licença | Open Data Commons ODbL |
| Formatos | ZIP, PARQUET, CSV |
| Recursos | 17 (4 no DataStore, consultáveis por API) |
| Granularidade | conjunto de unidades consumidoras / mensal |
| Cadência declarada | mensal |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=indicadores-coletivos-de-continuidade-dec-e-fec"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset indicadores-coletivos-de-continuidade-dec-e-fec`
Destino: `data/raw/aneel/indicadores-coletivos-de-continuidade-dec-e-fec/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `indicadores-continuidade-coletivos-2020-2029.zip`  — 4.984.416 linhas no arquivo / 2.757.500 no DataStore

`resource_id`: `4493985c-baea-429c-9df5-3030422c71d7`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=4493985c-baea-429c-9df5-3030422c71d7&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `DatGeracaoConjuntoDados` | timestamp | Data/hora da carga |
| `SigAgente / NumCNPJ` | text / numeric | Distribuidora |
| `IdeConjUndConsumidoras / DscConjUndConsumidoras` | numeric / text | Conjunto de unidades consumidoras — a granularidade do indicador |
| `SigIndicador` | text | Código do indicador (DEC, FEC, DECi, DECx, DECIP, DECXN, DICVLD…) — decodificar por `dominio-indicadores.csv` |
| `AnoIndice / NumPeriodoIndice` | numeric | Ano e período (mês) da apuração |
| `VlrIndiceEnviado` | text | Valor apurado — **texto** |

### `indicadores-continuidade-coletivos-limite.csv`  — 263.401 linhas

`resource_id`: `fd69e1dd-fd66-4269-b60c-cc0b7eb221b4`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=fd69e1dd-fd66-4269-b60c-cc0b7eb221b4&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `SigAgente / NumCNPJ / IdeConjUndConsumidoras` | — | Distribuidora e conjunto |
| `SigIndicador` | text | Indicador cujo limite é fixado |
| `AnoLimiteQualidade` | numeric | Ano de vigência do limite |
| `VlrLimite` | text | Limite regulatório — é o que se compara ao apurado para achar transgressão |

### `indicadores-continuidade-coletivos-atributos.csv`  — 776.216 linhas

`resource_id`: `3c780aca-38cf-406d-9d45-f07a9216eef2`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=3c780aca-38cf-406d-9d45-f07a9216eef2&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `SigIndicador` | text | Atributo físico-elétrico do conjunto (AREA, NumCon, ERP, PNIT, NUCTRU, k3…) |
| `AnoIndice / NumPeriodoIndice / VlrIndiceEnviado` | — | Mesma estrutura longa dos demais |

### `indicadores-continuidade-coletivos-compensacao-*.csv`

`resource_id`: `364d945e-a18b-4111-ab1b-73aa0f7b06b1`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=364d945e-a18b-4111-ab1b-73aa0f7b06b1&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `SigIndicador` | text | QTUCAT/PGUCAT e variantes — quantidade de UCs compensadas e valor pago por nível de tensão |

### `dominio-indicadores.csv`  — 484 linhas

`resource_id`: `17fc99b7-e707-4ec4-9553-a43d7a41f7a6`

```
https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=17fc99b7-e707-4ec4-9553-a43d7a41f7a6&limit=5
```

| Campo | Tipo | Descrição |
|---|---|---|
| `SigIndicador` | text | Código |
| `DscIndicador` | text | Descrição — **484 códigos**, a chave de leitura de todo o eixo de qualidade |
## Ressalvas do dado

> [!success] Schema conferido **e** conteúdo baixado em 2026-07-27
> Coletado por `data/scripts/coleta_qualidade_fiscalizacao.py`, com manifesto e SHA-256 em `data/raw/aneel/indicadores-coletivos-de-continuidade-dec-e-fec/2026-07-27/`. As ressalvas abaixo são as que a leitura do arquivo revelou — não as que o catálogo declarava.

> [!important] Quatro achados de estrutura, verificados no arquivo

> [!warning] O recurso `atributos` termina em 2014
> O arquivo `indicadores-continuidade-coletivos-atributos.csv` tem 776.216 linhas e o `AnoIndice` mais recente é **2014**. É ele que carrega o número de unidades consumidoras por conjunto (`NUCTRE`, `NUCTCO`, `NUCTIN`, `NUCTRU`, `NUCTOU`), a extensão de rede e o consumo — os atributos físico-elétricos do conjunto. **Consequência prática:** não é possível, só com dados abertos, ponderar DEC/FEC por unidade consumidora na janela 2020–2025, nem reproduzir a agregação temporal exata do PRODIST M8 (item 202, Equações 38 a 40), nem calcular o indicador global da distribuidora. O `refresh_frequency` declarado no catálogo é mensal — não é o que o arquivo mostra.

> [!warning] Só há valores mensais; o anual é derivado
> `NumPeriodoIndice` assume exclusivamente os valores 1 a 12. Não existe registro anual na fonte: o valor comparado ao limite tem de ser construído por agregação, com a ressalva acima.

> [!warning] Quebra nas rubricas de compensação em 2022
> As rubricas `PGUC*A` (violação do limite **anual**) desaparecem a partir de 2022 e as `PGUC*T` (trimestral) caem 90% de 2021 para 2022. A contagem `QTUC*` cai de ~80 milhões para ~20 milhões enquanto o valor pago sobe. Séries que atravessem 2021–2022 nessas rubricas **não são comparáveis**. Causa não verificada contra a REN 956/2021.

> [!warning] O recurso de compensação é declarado ZIP e entrega CSV
> O `format` do catálogo diz `ZIP`; a URL entrega um CSV de ~600 MB servido com throughput baixo. O recurso **PARQUET** equivalente (`51585540-7e99-44b5-92c5-7797f2693ae5`) tem 55 MB, já vem tipado e é o que a rotina de coleta usa.

> [!danger] O DataStore não contém o conjunto inteiro — usar a API dá resultado errado
> O arquivo `indicadores-continuidade-coletivos-2020-2029.csv`, extraído do ZIP, tem **4.984.416 registros**. O mesmo recurso no DataStore, consultável por `datastore_search` e SQL, expõe **2.757.500** — faltam **45% das linhas**. A ausência não é aleatória: o conjunto ANJO DA GUARDA (`IdeConjUndConsumidoras` 16207, EQUATORIAL MA) tem os doze meses de 2025 no arquivo e **zero** registros de 2025 no DataStore.
> **Consequência prática:** qualquer agregação feita pela API sobre este recurso está subestimada e não é reproduzível. Baixar o ZIP (ou o PARQUET) é obrigatório. A conferência amostral do arquivo contra a API, feita em 2026-07-27 em três conjuntos, bateu exatamente nos dois presentes nos dois lados — o problema é de **completude**, não de valor.

> [!question]
> Qual mudança normativa extinguiu as rubricas de compensação por apuração anual e trimestral a partir de 2022? E por que o recurso de atributos parou de ser atualizado em 2014, se o catálogo declara cadência mensal?

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

- [[Transgressão dos Limites Coletivos de Continuidade]] — `indicator` · conjuntos acima do limite anual de DEC/FEC
- [[Compensação por Violação dos Limites Individuais de Continuidade]] — `indicator` · R$ creditados ao consumidor
- [[Evolução da Transgressão dos Limites de DEC e FEC (2020–2025)]] — `series` · a curva da conformidade
- [[Evolução da Compensação por Continuidade e das Multas (2020–2025)]] — `series` · compensação × multa
- [[A transgressão do limite coletivo não tem consequência financeira direta]] — `insight`
- [[A qualidade média melhora enquanto a compensação individual cresce]] — `insight`
- [[A transgressão crônica se concentra e não muda de dono]] — `insight`

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Qualidade do Serviço]] · Ref: [[Serviço Adequado (Distribuição)]]
