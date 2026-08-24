---
title: EV-1-012 · Validação ITIL e artefatos-filhos (followup/task/solution)
aliases: [EV-1-012]
tags: [evidence, dominio/service-desk, validacao, followup]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-001 · src/CommonITILValidation.php L49,62–65 · src/ITILFollowup.php L44 · src/CommonITILTask.php · src/ITILSolution.php L42 · src/PendingReason.php L41"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-012 · Validação ITIL e artefatos-filhos (followup/task/solution)

> [!quote] classes (grep confirmado)
> ```php
> abstract class CommonITILValidation extends CommonDBChild {
>     const NONE=1; const WAITING=2; const ACCEPTED=3; const REFUSED=4;  // L62–65
> }                                    // → TicketValidation, ChangeValidation
> class ITILFollowup extends CommonDBChild { ... }  // acompanhamentos/comentários
> class CommonITILTask extends ...                   // tarefas (planejáveis, com duração)
> class ITILSolution extends CommonDBChild { ... }   // solução proposta/aplicada
> class PendingReason extends CommonDropdown { ... } // motivo de pendência (status WAITING)
> ```

Um objeto ITIL agrega **artefatos-filhos** ao longo do atendimento:
- **Followups** (`ITILFollowup`) — acompanhamentos/comentários na timeline.
- **Tasks** (`CommonITILTask`) — tarefas com responsável, duração e agendamento.
- **Solution** (`ITILSolution`) — solução, que leva o objeto a SOLVED.
- **Validation** (`CommonITILValidation`) — pedido de aprovação com estados
  NONE/WAITING/ACCEPTED/REFUSED (aprovação de requisições/mudanças).
- **PendingReason** — motivo padronizado quando o objeto entra em WAITING (pendente).

## Sustenta
- [[Fluxo de followups, tarefas e solução]]
- [[Validação e aprovação (regra)]]
