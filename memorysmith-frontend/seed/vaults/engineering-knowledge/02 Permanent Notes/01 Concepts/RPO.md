---
title: RPO
aliases:
  - Recovery Point Objective
tags:
  - resilience
  - backup
type: concept
status: evergreen
created: 2026-07-09
---
RPO define a quantidade máxima de dados que uma organização aceita perder após um incidente.

É medido em tempo.

```mermaid
timeline

title Linha do tempo

section Produção

Backup : 10h00m

Falha : 10h30m

Recuperação : 11h00m
```

> [!tip]
> Um RPO de 15 minutos significa que, no pior caso, até 15 minutos de dados podem ser perdidos.

## Quanto menor o RPO

- Maior custo
- Replicação mais frequente
- Melhor proteção dos dados

## Veja também

- [[RTO]]
- [[Backup]]
- [[Disaster Recovery]]