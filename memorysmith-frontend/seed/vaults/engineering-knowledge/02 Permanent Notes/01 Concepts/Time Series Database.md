---
title: Time Series Database
aliases:
  - TSDB
  - Banco de Série Temporal
tags:
  - database
  - metrics
  - observability
  - storage
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Banco especializado em dados indexados por tempo, otimizado para escrita massiva sequencial, agregação por janela e retenção decrescente.

## Conceito

Métrica tem uma forma peculiar: escreve-se muito, quase nunca se atualiza, lê-se por intervalo e o valor de um ponto individual decai rapidamente com o tempo. Bancos relacionais e documentais não são construídos para isso — daí a categoria própria.

O que um TSDB faz de diferente:

- **Escrita append-only** de alta cardinalidade.
- **Agregação nativa** por janela temporal, em vez de varredura.
- **Downsampling e retenção** — o dado antigo é reduzido a médias em vez de descartado.
- **Compressão específica** para séries numéricas, que reduz drasticamente o volume.

## Características

- **Alta cardinalidade é o inimigo.** Cada combinação distinta de labels cria uma série nova; explodir labels explode o custo.
- O ponto de dado é minimalista: timestamp + valor + conjunto de labels.
- A retenção costuma ser configurada por tamanho **ou** por tempo, não apenas por tempo.

## Exemplo

**Prometheus** guarda métricas como série temporal e é o padrão de facto em monitoramento de infraestrutura.

**[[Gnocchi]]** cumpre o papel na telemetria do OpenStack, substituindo o MongoDB que não escalava. A inversão de desenho é instrutiva: as amostras não vão direto ao banco — são convertidas, **agregadas** e só então gravadas, com recursos e atributos indexados. O armazenamento propriamente dito é delegado ao [[Swift]] ou ao [[Ceph]].

## Veja também

- [[Gnocchi]]
- [[Metrics]]
- [[Observability]]
- [[Tipos de Banco de Dados]]
