---
title: Distributed ID Generator
aliases:
  - Gerador de IDs Distribuído
  - Snowflake ID
tags:
  - distributed-systems
  - database
  - system-design
type: concept
status: evergreen
source: "BIG ARCHIVE: System Design 2023, ByteByteGo"
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
---
> [!abstract]
> Distributed ID Generator é o mecanismo que produz identificadores únicos em um sistema onde não existe um contador central — típico de bases particionadas por [[Database Sharding]].

## Conceito

Um `AUTO_INCREMENT` funciona porque existe uma única autoridade decidindo o próximo número. Quando o dado é particionado entre nós, essa autoridade deixa de existir, e é preciso escolher entre três propriedades que não vêm juntas: **unicidade garantida**, **ordenação temporal** e **independência de rede**.

## Estratégias

| Gerador | Como funciona | Custo |
|---|---|---|
| **UUID** | 128 bits gerados localmente | Não é sequencial — péssimo para índice B-tree. Unicidade é probabilística |
| **Snowflake** | timestamp + machine ID + número serial, com o primeiro bit reservado para manter o valor positivo | Depende de relógio confiável; *clock skew* quebra a ordenação |
| **Ticket server** | Um serviço central entrega faixas de IDs | Ponto único de falha e uma chamada de rede no caminho crítico |
| **Sequência por shard** | Cada shard usa um passo distinto | Simples, mas engessa o número de shards |

## Comparação

| Propriedade | UUID | Snowflake |
|---|---|---|
| Chamada de rede | Não | Não |
| Ordenável por tempo | Não | Sim |
| Amigável a índice | Não | Sim |
| Tamanho | 128 bits | 64 bits |

> [!important]
> "ID sequencial" e "ID ordenável" não são a mesma coisa. Snowflake é ordenável — IDs mais novos são maiores — mas tem lacunas. É essa ordenabilidade, não a continuidade, que o [[Database Index]] aproveita.

> [!warning]
> UUID não garante unicidade global, só a torna extremamente improvável. Em escala, "extremamente improvável" ainda precisa de tratamento de conflito.

## Veja também

- [[Database Sharding]]
- [[Database Index]]
- [[Latency Numbers]]
- [[CAP Theorem]]
