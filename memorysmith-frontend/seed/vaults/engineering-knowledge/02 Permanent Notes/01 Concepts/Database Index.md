---
title: Database Index
aliases:
  - Índice de Banco de Dados
  - Database Indexing
tags:
  - database
  - performance
  - data-structures
  - system-design
type: concept
status: evergreen
source: "BIG ARCHIVE: System Design 2023, ByteByteGo"
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
---
> [!abstract]
> Database Index é uma estrutura de dados auxiliar que permite localizar registros sem varrer a tabela inteira, ao custo de espaço e de escrita mais cara.

## Conceito

Índice é uma troca explícita: paga-se em escrita e armazenamento para ganhar em leitura. O que quase sempre se ignora é que **não existe "o" índice** — a estrutura por trás dele muda conforme o dado esteja em memória ou em disco, conforme o formato (número, texto, coordenada geográfica) e conforme a carga seja dominada por leitura ou por escrita.

## Estruturas usadas

| Estrutura | Onde aparece | Adequada a |
|---|---|---|
| **Skiplist** | Redis | Índice em memória, ordenado |
| **Hash index** | Vários engines | Busca por igualdade exata |
| **SSTable** | LSM-based stores | Tabela ordenada, imutável, em disco |
| **LSM Tree** | RocksDB, Cassandra | Carga dominada por escrita |
| **B-Tree / B+Tree** | PostgreSQL, MySQL | Uso geral, consultas por intervalo |
| **Inverted Index** | Elasticsearch, Lucene | Busca textual |
| **Suffix Tree** | Motores de busca | Busca por substring |
| **R-Tree** | PostGIS | Dados espaciais e proximidade |

## Comparação

| | **B-Tree** | **LSM Tree** |
|---|---|---|
| Escrita | Atualização in-place, mais cara | Append em memória, depois flush — barata |
| Leitura | Previsível, poucos acessos | Pode precisar consultar vários níveis |
| Amplificação | De escrita | De leitura e de espaço (compactação) |

> [!important]
> A escolha do índice determina qual gerador de ID faz sentido. Um [[Distributed ID Generator]] que produz UUIDs aleatórios espalha as inserções por toda a B-Tree; IDs ordenáveis como Snowflake concentram a escrita no fim da árvore.

## Veja também

- [[Database Sharding]]
- [[Distributed ID Generator]]
- [[Latency Numbers]]
- [[Distributed Cache]]
