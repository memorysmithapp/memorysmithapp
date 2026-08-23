---
title: ELT
aliases:
  - Extract Load Transform
tags:
  - data-engineering
type: concept
status: evergreen
created: 2026-07-09
---
ELT é uma abordagem em que os dados são carregados primeiro no ambiente analítico e transformados posteriormente.

```mermaid
graph LR

Source --> Extract

Extract --> Load

Load --> DataLake["Data Lake"]

DataLake --> Transform
```

> [!tip]
> ELT tornou-se popular com Data Lakes e plataformas analíticas em nuvem.

## Benefícios

- Escalabilidade
- Flexibilidade
- Processamento distribuído

## Veja também

- [[Data Pipeline]]
- [[ETL]]
- [[Data Lake]]
- [[Data Warehouse]]