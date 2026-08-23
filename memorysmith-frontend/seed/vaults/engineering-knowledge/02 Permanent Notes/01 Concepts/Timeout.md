---
title: Timeout
aliases:
  - Tempo Limite
tags:
  - resilience
  - distributed-systems
  - system-design
type: concept
status: evergreen
source: Timeouts, retries, and backoff with jitter — Amazon Builders' Library
author: Marc Brooker (AWS)
created: 2026-07-25
---
> [!abstract]
> Timeout é o tempo máximo que um cliente espera por uma resposta antes de desistir — a defesa contra a falha mais comum em sistemas distribuídos, que não é o erro, é a **espera indefinida**.

## Conceito

Muitas falhas não se manifestam como erro, e sim como requisições que demoram mais que o normal e potencialmente nunca terminam. Enquanto espera, o cliente mantém presos os recursos daquela requisição: memória, threads, conexões, portas efêmeras. Quando muitas requisições fazem isso ao mesmo tempo, o **cliente** se esgota — por causa de um problema no servidor.

A prática na Amazon é definir timeout em **toda chamada remota**, e em geral em qualquer chamada entre processos, mesmo na mesma máquina. Isso inclui timeout de conexão e timeout de requisição.

## Como escolher o valor

O valor é o problema difícil. Alto demais reduz a utilidade — os recursos continuam presos. Baixo demais tem dois riscos: mais tráfego e mais latência no backend por excesso de retentativas, e um pequeno aumento de latência no backend virando indisponibilidade total, porque *tudo* passa a ser retentado.

```text
1. Escolher uma taxa aceitável de timeouts falsos     → ex.: 0,1%
2. Olhar o percentil de latência correspondente
   no serviço de destino                              → ex.: p99.9
3. Usar esse valor como ponto de partida
```

> [!warning] Onde o método não funciona
> - **Clientes com latência de rede alta** (internet aberta): é preciso considerar o pior caso razoável, lembrando que os clientes podem estar em qualquer lugar do mundo
> - **Serviços com latência muito apertada**, onde p99.9 é próximo de p50: sem folga, pequenas variações viram timeouts em massa

## A armadilha do handshake

Em um sistema da Amazon, timeouts apareciam sempre logo após cada deploy, com o valor em 20 ms. O timer incluía o estabelecimento da conexão segura — reaproveitada nas requisições seguintes, mas cara na primeira. A correção definitiva não foi aumentar o timeout: foi **estabelecer as conexões na inicialização do processo, antes de receber tráfego**.

> [!tip]
> Prefira os timeouts embutidos em clientes bem testados. Implementações próprias frequentemente não cobrem todas as chamadas remotas — DNS e handshake TLS costumam ficar de fora.

## Fonte

- Marc Brooker, [Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/), Amazon Builders' Library

## Veja também

- [[Retry Pattern]]
- [[Circuit Breaker]]
- [[Bulkhead]]
- [[Distributed Systems]]
- [[Latency Numbers]]
- [[System Design MOC]]
