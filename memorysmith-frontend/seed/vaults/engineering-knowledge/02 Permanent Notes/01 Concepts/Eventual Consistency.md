---
title: Eventual Consistency
aliases:
  - Consistência Eventual
  - Consistência Fraca
tags:
  - distributed-systems
  - consistency
  - database
  - system-design
type: concept
status: evergreen
source: Eventually Consistent, Revisited — ACM Queue, 2008
author: Werner Vogels (Amazon)
created: 2026-07-25
---
> [!abstract]
> Eventual Consistency é a garantia de que, **se nenhuma atualização nova for feita**, todas as leituras acabarão retornando o último valor escrito — sem prometer quando.

## Conceito

Réplicas existem para dar disponibilidade e desempenho, mas não conseguem ser atualizadas instantaneamente. O intervalo entre a escrita e o momento em que todo observador enxerga o novo valor é a **janela de inconsistência**.

Consistência eventual não é uma esquisitice de sistemas extremos. Todo RDBMS com replicação assíncrona já a oferece: se a réplica é lida antes do log chegar, o valor é antigo. O DNS é o exemplo mais difundido de sistema eventualmente consistente em produção.

## Modelos de consistência do lado do cliente

| Modelo | Garantia |
|---|---|
| **Strong consistency** | Depois que a escrita completa, qualquer acesso retorna o novo valor |
| **Weak consistency** | Não há garantia de quando o novo valor aparece |
| **Eventual consistency** | Forma específica de weak: sem novas escritas, todos convergem para o último valor |

Variações práticas que tornam a consistência eventual utilizável:

- **Causal** — se A avisou B que atualizou, a leitura de B reflete a atualização
- **Read-your-writes** — quem escreveu nunca lê um valor mais antigo que o próprio
- **Session** — read-your-writes válido enquanto durar a sessão
- **Monotonic read** — nunca se volta a ver um valor anterior ao já visto
- **Monotonic write** — as escritas do mesmo processo são serializadas

> [!tip]
> Na prática, **monotonic reads** e **read-your-writes** são as duas mais desejáveis. Elas escondem a inconsistência exatamente de quem mais notaria — o usuário que acabou de agir.

## Do lado do servidor: o quórum

Com `N` réplicas, `W` confirmações na escrita e `R` réplicas lidas:

| Condição | Resultado |
|---|---|
| `W + R > N` | Conjuntos de leitura e escrita se sobrepõem → **consistência forte** |
| `W + R ≤ N` | Podem não se sobrepor → **consistência eventual** |

```text
N = 3, W = 2, R = 2  →  2 + 2 > 3  →  forte, tolerando 1 falha
N = 3, W = 1, R = 1  →  1 + 1 ≤ 3  →  eventual, escrita rápida
```

> [!important] Não confundir com o C do ACID
> A consistência do ACID é a garantia de que o banco termina a transação em estado válido — responsabilidade de quem escreve a transação. A consistência aqui discutida é sobre **quando cada observador enxerga a atualização**. São conceitos distintos com o mesmo nome.

## Exemplo

O carrinho de compras da Amazon é *write-always*: durante uma partição de rede o cliente continua adicionando itens, mesmo que o carrinho original viva do outro lado. A aplicação faz o merge quando a partição cicatriza — indisponibilidade seria pior que divergência temporária.

## Fonte

- Werner Vogels, [Eventually Consistent - Revisited](https://www.allthingsdistributed.com/2008/12/eventually_consistent.html), ACM Queue, 2008

## Veja também

- [[CAP Theorem]]
- [[Consensus]]
- [[Distributed Systems]]
- [[Database Sharding]]
- [[Saga]]
- [[System Design MOC]]
