---
title: EV-1-013 · Change e Problem estendem CommonITILObject com fases próprias
aliases: [EV-1-013]
tags: [evidence, dominio/service-desk, change, problem]
type: evidence
status: confirmed
source: "SRC-001 · src/Change.php L46,60–70 · src/Problem.php L46,61–64"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-013 · Change e Problem estendem CommonITILObject com fases próprias

> [!quote] `src/Change.php`
> ```php
> class Change extends CommonITILObject implements DefaultSearchRequestInterface {
>     public const STATUS_MATRIX_FIELD = 'change_status';
>     // statuses adicionais (além dos herdados):
>     const EVALUATION=9; const APPROVAL=10; const TEST=11;
>     const QUALIFICATION=12; const REFUSED=13; const CANCELED=14;
> }
> ```
> `src/Problem.php` → `class Problem extends CommonITILObject` com `STATUS_MATRIX_FIELD = 'problem_status'`.

**Change** e **Problem** reaproveitam toda a maquinaria de [[CommonITILObject (base de service desk)]]
(atores, prioridade, timeline, SLA, validação) mas têm **máquinas de estado próprias**:
- **Change** acrescenta as fases ITIL de mudança: **avaliação** (EVALUATION), **aprovação**
  (APPROVAL), **teste** (TEST), **qualificação** (QUALIFICATION), além de REFUSED/CANCELED.
- **Problem** foca no ciclo de análise de causa-raiz (statuses próprios em `problem_status`).

## Sustenta
- [[Gestão de Mudanças (processo)]]
- [[Gestão de Problemas (processo)]]
