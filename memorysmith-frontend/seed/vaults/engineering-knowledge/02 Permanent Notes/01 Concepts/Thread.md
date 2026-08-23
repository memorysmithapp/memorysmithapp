---
title: Thread
aliases:
  - Linha de Execução
  - Multithreading
tags:
  - operating-system
  - computing
  - performance
  - system-design
type: concept
status: evergreen
source: IEEE Std 1003.1 POSIX Threads; Modern Operating Systems, Andrew S. Tanenbaum
author: IEEE · Andrew S. Tanenbaum
created: 2026-07-25
---
> [!abstract]
> Thread é uma linha de execução dentro de um [[Processo (Computação)]]. Threads do mesmo processo **compartilham a memória** — o que as torna baratas e perigosas pelo mesmo motivo.

## Conceito

Criar um processo para cada tarefa concorrente é caro: memória duplicada, troca de contexto pesada, comunicação por IPC. A thread resolve isso executando em paralelo **dentro** do processo, compartilhando o espaço de endereçamento.

O compartilhamento é a vantagem — comunicação é apenas ler e escrever uma variável — e é a origem de toda a dificuldade: duas threads escrevendo a mesma variável ao mesmo tempo produzem resultado indefinido.

## O custo do compartilhamento

| Problema | O que acontece |
|---|---|
| **Race condition** | O resultado depende da ordem em que as threads chegam |
| **Deadlock** | Duas threads esperam uma pela outra, para sempre |
| **Starvation** | Uma thread nunca consegue o recurso de que precisa |
| **Falha propagada** | Uma thread que aborta o processo derruba todas as outras |

Os mecanismos de proteção — mutex, semáforo, lock — resolvem a corrida introduzindo **serialização**, o que devolve parte do paralelismo que se buscava.

> [!warning]
> Concorrência é a fonte de bugs mais cara de reproduzir: dependem de temporização, não aparecem em teste e não se comportam igual duas vezes. É o mesmo perfil dos bugs distribuídos descritos em [[Distributed Systems]] — e pela mesma razão de fundo, a ausência de ordem garantida.

## Onde aparece em arquitetura

- **Thread pool** é a unidade que [[Bulkhead]] compartimenta para conter falha em cascata
- **Esgotamento de threads** é o que acontece quando chamadas remotas ficam presas sem [[Timeout]]
- Modelos alternativos — corrotinas, loop de eventos, *green threads* — buscam concorrência sem o custo de uma thread do sistema operacional por tarefa

## Fonte

- IEEE, *Std 1003.1 — POSIX Threads*
- Andrew S. Tanenbaum, *Modern Operating Systems*, Pearson

## Veja também

- [[Processo (Computação)]]
- [[Bulkhead]]
- [[Timeout]]
- [[Distributed Systems]]
- [[Container]]
- [[System Design MOC]]
