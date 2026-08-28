---
title: Bloqueio de campos manuais no inventário (locks)
aliases: [Locks, Bloqueio de campos, Field lock]
tags: [assets, inventory, locks, behavior]
type: flow
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-c1-003 · Formulário e abas de Computador|EV-2-c1-003]]"
  - "[[EV-2-c1-007 · Formulário e abas de Impressora|EV-2-c1-007]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Bloqueio de campos manuais no inventário (locks)

Regra de comportamento comum a todos os tipos de ativo inventariados:

> [!quote] Doc (repetido em todos os tipos)
> "if you modify a field manually, it will be considered locked. This will prevent it from being modified the next time the automatic inventory is uploaded."

Ou seja, **modificar um campo manualmente o marca como bloqueado (locked)**, impedindo que o próximo upload do inventário automático o sobrescreva. A aba **Locks** permite bloquear/desbloquear manualmente os campos desejados de um objeto GLPI.

## Ponte doc × código
- Comportamento parte do [[Fluxo de inventário nativo]] e da [[Inventário automático (processo)]].
- Relaciona-se ao [[Ciclo de vida de um item (add-update-delete)]] quando a atualização vem do agente.
</content>
