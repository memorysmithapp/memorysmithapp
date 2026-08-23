---
title: Data Pipeline
aliases:
  - Pipeline de Dados
  - Data Pipelines
tags:
  - data
  - architecture
  - analytics
  - system-design
type: concept
status: evergreen
source: Data Pipelines Overview — BIG ARCHIVE System Design 2023
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
---
> [!abstract]
> Data Pipeline é o encadeamento das cinco fases que levam o dado da origem até o consumo: **coletar, ingerir, armazenar, computar e consumir**.

## Conceito

Dado bruto espalhado por sistemas operacionais não responde pergunta nenhuma. O pipeline é o que o transforma em algo consultável — e cada fase tem uma decisão de arquitetura própria.

```mermaid
flowchart LR
    C[1. Coletar] --> I[2. Ingerir]
    I --> S[3. Armazenar]
    S --> P[4. Computar]
    P --> U[5. Consumir]
```

| Fase | O que acontece |
|---|---|
| **Coletar** | Dado é adquirido de bancos, streams e aplicações — remotamente, de dispositivos ou sistemas de negócio |
| **Ingerir** | Carregado nos sistemas e organizado em filas de evento. Ver [[Message Queue]] e [[Event Streaming Platform]] |
| **Armazenar** | Guardado em [[Data Warehouse]], [[Data Lake]], lakehouse ou bancos |
| **Computar** | Agregação, limpeza e transformação para o padrão da empresa — conversão de formato, compressão, particionamento. Em lote ou em fluxo |
| **Consumir** | Disponibilizado para análise, dashboards, [[Business Intelligence]], modelos de machine learning e aplicações |

## Batch × Stream

A fase de computação admite dois regimes, e a escolha define a arquitetura inteira:

| | **Batch** | **Stream** |
|---|---|---|
| Processa | Blocos acumulados em janelas | Evento a evento, conforme chega |
| Latência | Minutos a horas | Segundos ou menos |
| Complexidade | Menor | Maior — ordenação, janelas, estado |
| Reprocessar | Trivial: roda de novo | Exige replay do log de eventos |

> [!important] ETL e ELT são recortes deste pipeline
> [[ETL]] transforma **antes** de armazenar; [[ELT]] armazena o dado bruto e transforma depois, dentro do destino. A virada de ETL para ELT acompanhou o barateamento do armazenamento e o surgimento do [[Data Lake]] — deixou de valer a pena decidir o formato final antes de saber que perguntas seriam feitas.

> [!warning]
> A eficácia do pipeline é limitada pela sua fase mais fraca. Computação sofisticada sobre dado coletado de forma inconsistente produz relatório errado com aparência de rigor — o pior resultado possível, porque ninguém desconfia dele.

## Fonte

- ByteByteGo, *Data Pipelines Overview* — BIG ARCHIVE: System Design 2023

## Veja também

- [[ETL]]
- [[ELT]]
- [[Data Lake]]
- [[Data Warehouse]]
- [[Event Streaming Platform]]
- [[Tipos de Banco de Dados]]
- [[Business Intelligence]]
- [[System Design MOC]]
