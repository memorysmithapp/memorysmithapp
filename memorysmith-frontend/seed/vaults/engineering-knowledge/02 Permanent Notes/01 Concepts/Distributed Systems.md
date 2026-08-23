---
title: Distributed Systems
aliases:
  - Sistemas Distribuídos
  - Sistema Distribuído
tags:
  - distributed-systems
  - architecture
  - system-design
type: concept
status: evergreen
source: Challenges with distributed systems — Amazon Builders' Library, 2019
author: Jacob Gabrielson (AWS)
created: 2026-07-25
---
> [!abstract]
> Distributed System é um sistema cujos componentes rodam em máquinas distintas e coordenam-se por rede — o que introduz duas propriedades ausentes de qualquer sistema local: **falhas independentes** e **não determinismo**.

## Conceito

O que torna sistemas distribuídos difíceis não é a rede em si — TCP/IP, DNS e sockets são complicados, mas se parecem com outros problemas de computação. O que muda tudo é que a mensagem cruza uma **fronteira de falha** (*fault domain*).

Em uma máquina só, os componentes **compartilham destino**: se a CPU derrete, tudo cai junto, e o engenheiro não precisa tratar esse caso. Quando cliente, rede e servidor podem falhar de forma independente, cada combinação vira um caso a tratar.

## As oito formas de falha

Uma única troca requisição/resposta tem oito passos obrigatórios, e **cada um pode falhar sozinho**:

```mermaid
flowchart LR
    C[Cliente] -->|1. posta requisição| N1[Rede]
    N1 -->|2. entrega| S[Servidor]
    S -->|3. valida| S2[4. atualiza estado]
    S2 -->|5. posta resposta| N2[Rede]
    N2 -->|6. entrega| C2[Cliente]
    C2 -->|7. valida| C3[8. atualiza estado]
```

## O problema do UNKNOWN

Das falhas possíveis, uma é qualitativamente diferente: o **timeout**. Quando a resposta não chega, o cliente não sabe se a operação aconteceu ou não. O resultado não é sucesso nem erro — é `UNKNOWN`.

> [!warning] É aqui que a intuição humana quebra
> Um saque bancário que retorna `UNKNOWN` pode ter debitado a conta ou não. Repetir arrisca debitar duas vezes; não repetir arrisca perder a operação. A única saída estrutural é tornar a operação segura para repetição — ver [[Idempotência]].

## Características

- **Bugs distribuídos são latentes**: nascem em produção meses após o deploy, quando a combinação certa de falhas finalmente ocorre
- **Bugs distribuídos se espalham**: por definição envolvem a rede, que é justamente o que liga as máquinas
- **O problema é recursivo**: grupos de máquinas falam com outros grupos, e as mesmas oito falhas se repetem em cada nível de abstração
- A matriz de testes explode: cada chamada de rede multiplica os cenários por cinco (`POST_FAILED`, `RETRYABLE`, `FATAL`, `UNKNOWN`, `SUCCESS`)

## Fonte

- Jacob Gabrielson, [Challenges with distributed systems](https://aws.amazon.com/builders-library/challenges-with-distributed-systems/), Amazon Builders' Library

## Veja também

- [[CAP Theorem]]
- [[Eventual Consistency]]
- [[Consensus]]
- [[Idempotência]]
- [[Retry Pattern]]
- [[Latency Numbers]]
- [[Microservices]]
- [[System Design MOC]]
