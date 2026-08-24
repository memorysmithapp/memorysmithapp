---
title: EV-1-008 · CommonITILObject define statuses e matriz de prioridade
aliases: [EV-1-008]
tags: [evidence, dominio/service-desk, itil]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-001 · codebase/in/glpi/src/CommonITILObject.php · L76, 120–128, 3318–3322, 3891–3912"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-008 · CommonITILObject define statuses e matriz de prioridade

> [!quote] `src/CommonITILObject.php`
> ```php
> abstract class CommonITILObject extends CommonDBTM
>     implements KanbanInterface, TeamworkInterface           // L76
>
> // Statuses (L120–128)
> const INCOMING = 1;  const ASSIGNED = 2;  const PLANNED  = 3;
> const WAITING  = 4;  const SOLVED   = 5;  const CLOSED   = 6;
> const ACCEPTED = 7;  const OBSERVED = 8;  const APPROVAL  = 10;
>
> // Prioridade derivada de urgência × impacto (L3318)
> public static function computePriority($urgency, $impact) {
>     return $CFG_GLPI[static::MATRIX_FIELD][$urgency][$impact]
>            ?? (int) round(($urgency + $impact) / 2);
> }
>
> // Transições de status são CONFIGURÁVEIS POR PERFIL (L3891)
> public static function isAllowedStatus($old, $new) {
>     // consulta $_SESSION['glpiactiveprofile'][STATUS_MATRIX_FIELD][$old][$new]
> }
> ```

`CommonITILObject` é a **superclasse abstrata** de [[Ticket]], [[Change]] e [[Problem]].
Define o vocabulário comum ITIL: um conjunto fixo de **statuses**, a **prioridade** derivada
de uma **matriz urgência × impacto** configurável (`priority_matrix` em `CFG_GLPI`), e
transições de status **governadas por uma matriz por perfil** (`ticket_status[old][new]`) —
não hard-coded. Implementa Kanban e Teamwork.

## Sustenta
- [[CommonITILObject (base de service desk)]]
- [[Priorização (urgência × impacto)]]
- [[Ciclo de vida de um Ticket (máquina de estados)]]
