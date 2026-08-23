---
title: CAP Theorem
aliases:
  - Brewer's Theorem
tags:
  - distributed-systems
type: concept
status: evergreen
created: 2026-07-09
---
O Teorema CAP afirma que um sistema distribuído pode garantir, no máximo, duas das seguintes propriedades:

- Consistency
- Availability
- Partition Tolerance

```mermaid
graph TD

CAP --> C[Consistency]
CAP --> A[Availability]
CAP --> P[Partition Tolerance]
```

> [!warning]
> Em presença de falhas de rede (Partition), é necessário escolher entre Consistency ou Availability.

## Exemplos

CP

- MongoDB (configuração específica)
- ZooKeeper

AP

- Cassandra
- DynamoDB

## Veja também

- [[Database Sharding]]
- [[Distributed Cache]]
- [[System Design MOC]]
- [[Distributed Systems]]
- [[Eventual Consistency]]
- [[Consensus]]