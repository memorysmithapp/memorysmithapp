---
title: Data Warehouse
aliases:
  - DW
  - Armazém de Dados
tags:
  - data
  - analytics
  - storage
type: concept
status: evergreen
created: 2026-07-09
---
Data Warehouse é um repositório de dados estruturados, organizado para consultas analíticas, Business Intelligence (BI) e geração de relatórios.

Os dados são extraídos de diferentes sistemas, transformados e armazenados em um modelo otimizado para análise.

```mermaid
flowchart LR

Operational["Sistemas Operacionais"] --> ETL["ETL / ELT"]

ETL --> DW["Data Warehouse"]

DW --> BI["Business Intelligence"]
DW --> Reports["Relatórios"]
DW --> Analytics["Analytics"]
```

> [!info]
> Diferentemente de um [[Data Lake]], um Data Warehouse armazena dados já tratados, organizados e modelados para consultas rápidas.

## Características

- Dados estruturados
- Modelo dimensional
- Alto desempenho para consultas
- Histórico consolidado

## Casos de uso

- Dashboards
- Business Intelligence
- Indicadores corporativos
- Análises históricas

## Exemplos

- Amazon Redshift
- Google BigQuery
- Snowflake
- Azure Synapse Analytics

## Data Lake x Data Warehouse

| Característica | Data Lake | Data Warehouse |
|----------------|-----------|----------------|
| Dados | Brutos | Processados |
| Estrutura | Flexível | Modelada |
| Uso | Data Science | BI |
| Custo | Menor | Maior |
| Performance analítica | Média | Alta |

## Veja também

- [[Data Pipeline]]
- [[Data Lake]]
- [[ETL]]
- [[ELT]]
- [[Business Intelligence]]