---
title: RTO
aliases:
  - Recovery Time Objective
tags:
  - resilience
type: concept
status: evergreen
created: 2026-07-09
---
RTO representa o tempo máximo aceitável para restaurar um serviço após uma interrupção.

```mermaid
timeline

title Recuperação

section Incidente

Falha : 10h00m

Serviço Restaurado : 10h30m
```

> [!info]
> Quanto menor o RTO, maior costuma ser o investimento em infraestrutura e automação.

## Exemplos

| Sistema | RTO |
|----------|----:|
| Banco | 5 min |
| ERP | 30 min |
| Portal institucional | 2 horas |

## Veja também

- [[RPO]]
- [[Disaster Recovery]]
- [[High Availability]]