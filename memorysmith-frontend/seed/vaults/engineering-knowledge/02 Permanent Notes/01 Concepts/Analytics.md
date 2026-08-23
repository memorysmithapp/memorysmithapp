---
title: Analytics
aliases:
  - Análise de Dados
  - Analítica
tags:
  - data
  - analytics
  - business-intelligence
type: concept
status: evergreen
source: Data Pipelines Overview — BIG ARCHIVE System Design 2023
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
---
> [!abstract]
> Analytics é o conjunto de práticas que transforma dado bruto em resposta — e se distingue por **que pergunta** cada tipo responde.

## Conceito

"Analytics" costuma ser usado como sinônimo de dashboard, o que esconde uma escada de maturidade em que cada degrau é qualitativamente mais difícil que o anterior:

| Tipo | Pergunta | Exemplo |
|---|---|---|
| **Descritiva** | O que aconteceu? | Vendas caíram 12% no trimestre |
| **Diagnóstica** | Por que aconteceu? | A queda se concentra em um canal específico |
| **Preditiva** | O que vai acontecer? | A tendência projeta mais 8% de queda |
| **Prescritiva** | O que devemos fazer? | Realocar verba do canal X para o Y |

```mermaid
flowchart LR
    D[Descritiva] --> DG[Diagnóstica] --> P[Preditiva] --> PR[Prescritiva]
```

## De onde vem o dado

Analytics é a fase de **consumo** do [[Data Pipeline]]. Depende de tudo que veio antes: coleta, ingestão, armazenamento em [[Data Warehouse]] ou [[Data Lake]] e computação. O consumo se dá por ferramentas de visualização, [[Business Intelligence]], motores de decisão, modelos de machine learning e autoatendimento analítico.

> [!important] OLTP não é lugar de analytics
> Rodar consulta analítica no banco transacional é a causa clássica de degradação em produção — a varredura de milhões de linhas compete com as transações dos usuários. É a razão de existir a separação OLTP × OLAP descrita em [[Tipos de Banco de Dados]].

> [!warning]
> A qualidade da análise é limitada pela fase mais fraca do pipeline. Uma projeção sofisticada sobre dado coletado de forma inconsistente produz um número com aparência de rigor e sem lastro — e, por parecer rigoroso, ninguém o questiona.

## Fonte

- ByteByteGo, *Data Pipelines Overview* — BIG ARCHIVE: System Design 2023

## Veja também

- [[Business Intelligence]]
- [[Data Pipeline]]
- [[Data Warehouse]]
- [[Data Lake]]
- [[Tipos de Banco de Dados]]
- [[ETL]]
- [[Metrics]]
