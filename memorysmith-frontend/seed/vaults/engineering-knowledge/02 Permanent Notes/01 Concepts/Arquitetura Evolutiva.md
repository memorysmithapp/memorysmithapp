---
title: Arquitetura Evolutiva
aliases:
  - Evolutionary Architecture
  - Fitness Function
  - Função de Aptidão
tags:
  - architecture
  - system-design
  - engineering
type: concept
status: evergreen
source: Building Evolutionary Architectures — Neal Ford, Rebecca Parsons e Patrick Kua, O'Reilly
author: Neal Ford, Rebecca Parsons e Patrick Kua (Thoughtworks)
created: 2026-07-25
---
> [!abstract]
> Arquitetura evolutiva é a que **suporta mudança guiada e incremental** ao longo de múltiplas dimensões — em vez de tentar acertar o desenho definitivo no início.

## Conceito

A premissa tradicional é que a arquitetura deve ser decidida cedo e depois protegida da erosão. Ela falha porque o ambiente muda: negócio, escala, tecnologia e regulação se movem mais rápido do que qualquer previsão inicial.

A alternativa não é abrir mão de arquitetura, é **projetar para a mudança** e tornar mensurável se as características desejadas continuam valendo.

## Os três pilares

| Pilar | O que significa |
|---|---|
| **Mudança incremental** | O sistema pode ser construído e implantado em partes pequenas — depende de [[Pipeline de CI-CD]] e testes automatizados |
| **Guiada por fitness functions** | Cada característica arquitetural desejada vira uma verificação executável e contínua |
| **Múltiplas dimensões** | Não só código: dados, segurança, operação e estrutura de times evoluem juntos |

## Fitness functions

Uma *fitness function* é qualquer mecanismo que avalia objetivamente se a arquitetura mantém uma característica desejada:

| Característica | Fitness function |
|---|---|
| Desempenho | Teste que falha se o p99 passar de 200 ms |
| Acoplamento | Verificação que quebra o build se a camada de domínio importar a de infraestrutura |
| Resiliência | Experimento de [[Chaos Engineering]] rodando continuamente |
| Segurança | Varredura de dependências vulneráveis no pipeline |
| Escalabilidade | Teste de carga além do ponto de ruptura, como em [[Load Shedding]] |

> [!important] O ponto é transformar princípio em teste
> "Queremos baixo acoplamento" é uma intenção que erode em silêncio. A mesma intenção como verificação que **quebra o build** não erode — e é isso que distingue arquitetura evolutiva de boas intenções arquiteturais.

> [!warning]
> Evolutiva não significa emergente. O desenho continua sendo deliberado; o que muda é a aceitação de que ele será revisto, e a construção dos mecanismos que tornam a revisão segura. Sem testes, pipeline e observabilidade, "evoluir" vira "quebrar".

## Fonte

- Neal Ford, Rebecca Parsons e Patrick Kua, *Building Evolutionary Architectures*, O'Reilly

## Veja também

- [[Strangler Fig]]
- [[Lei de Conway]]
- [[Bounded Context]]
- [[Pipeline de CI-CD]]
- [[Chaos Engineering]]
- [[DORA Metrics]]
- [[Enterprise Architecture]]
