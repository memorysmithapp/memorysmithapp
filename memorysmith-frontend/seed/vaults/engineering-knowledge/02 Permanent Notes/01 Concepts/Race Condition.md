---
title: Race Condition
aliases:
  - Condição de Corrida
  - Data Race
tags:
  - computing
  - concurrency
  - operating-system
  - system-design
type: concept
status: evergreen
source: Modern Operating Systems, Andrew S. Tanenbaum; IEEE Std 1003.1 POSIX
author: Andrew S. Tanenbaum · IEEE
created: 2026-07-25
---
> [!abstract]
> Race condition é a situação em que **o resultado depende da ordem** em que threads ou processos concorrentes chegam a um recurso compartilhado — ordem que ninguém controla.

## Conceito

Duas [[Thread|threads]] executando `saldo = saldo + 100` parecem fazer a mesma coisa duas vezes. Na verdade a operação tem três passos — ler, somar, escrever — e a intercalação decide o resultado:

```text
Thread A: lê saldo (1000)
Thread B: lê saldo (1000)
Thread A: soma 100 → escreve 1100
Thread B: soma 100 → escreve 1100   ← um depósito desapareceu
```

O trecho em que o recurso compartilhado é manipulado é a **seção crítica**. A correção exige garantir que apenas um fluxo esteja nela por vez — com mutex, semáforo ou operação atômica.

## Por que é tão caro depurar

> [!warning]
> Race conditions dependem de **temporização**, não de entrada. Isso significa que não aparecem em teste, não se reproduzem duas vezes iguais, somem quando se adiciona um log — porque o log muda o tempo — e se manifestam em produção sob carga, que é justamente quando a intercalação fica provável.
>
> É o mesmo perfil dos bugs descritos em [[Distributed Systems]], pela mesma razão de fundo: ausência de ordem garantida.

## A mesma corrida, em escala distribuída

O problema não some ao trocar threads por serviços — só muda de nome:

| Nível | Recurso compartilhado | Mecanismo de proteção |
|---|---|---|
| **Thread** | Variável em memória | Mutex, semáforo, operação atômica |
| **Processo** | Arquivo, memória compartilhada | Lock de arquivo, semáforo do SO |
| **Serviço** | Registro no banco | Transação, lock otimista, versionamento |
| **Sistema distribuído** | Estado replicado | [[Consensus]], quórum, [[Idempotência]] |

> [!important]
> Serializar corrige a corrida devolvendo parte do paralelismo que se buscava. É o mesmo trade-off da Lei de Amdahl que limita o ganho em [[Load Shedding]]: o ponto de serialização é o teto.

## Fonte

- Andrew S. Tanenbaum, *Modern Operating Systems*, Pearson
- IEEE, *Std 1003.1 — POSIX Threads*

## Veja também

- [[Thread]]
- [[Deadlock]]
- [[Processo (Computação)]]
- [[Thread Pool]]
- [[Idempotência]]
- [[Consensus]]
- [[System Design MOC]]
