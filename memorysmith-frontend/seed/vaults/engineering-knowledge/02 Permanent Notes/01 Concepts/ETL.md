---
title: ETL
aliases:
  - Extract Transform Load
tags:
  - data-engineering
type: concept
status: evergreen
created: 2026-07-09
---
ETL é o processo de **Extrair**, **Transformar** e **Carregar** dados para um repositório analítico.

```mermaid
graph LR

Source --> Extract

Extract --> Transform

Transform --> Load

Load --> DataWarehouse["Data Warehouse"]
```

> [!info]
> No ETL, os dados são transformados antes de serem armazenados.

## Etapas

- Extract
- Transform
- Load

## Casos de uso

- Business Intelligence
- Relatórios corporativos
- Data Warehouse

## Veja também

- [[Data Pipeline]]
- [[ELT]]
- [[Data Warehouse]]
- [[Business Intelligence]]