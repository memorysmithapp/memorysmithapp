---
title: EV-1-006 · Profile e ProfileRight definem RBAC helpdesk vs standard
aliases: [EV-1-006]
tags: [evidence, dominio/foundation, seguranca, perfis]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-001 · codebase/in/glpi/src/Profile.php (L57–86) · src/ProfileRight.php"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-006 · Profile e ProfileRight definem RBAC helpdesk vs standard

> [!quote] `src/Profile.php` (L65–86)
> ```php
> // Helpdesk fields of helpdesk profiles
> public static $helpdesk_rights = [
>     'create_ticket_on_login', 'changetemplates_id', 'followup',
>     'helpdesk_hardware', 'helpdesk_item_type', 'knowbase',
>     'password_update', 'personalization', 'problemtemplates_id',
>     'reminder_public', 'reservation', 'rssfeed_public',
>     'show_group_hardware', 'use_mentions', 'task', 'ticket',
>     'ticket_cost', 'ticket_status', 'tickettemplates_id', 'ticketvalidation',
> ];
> ```

Um **Profile** (perfil) agrupa direitos e define a **interface** do usuário: `helpdesk`
(interface simplificada — apenas os `$helpdesk_rights`) ou `central` (interface completa).
Cada linha em **`ProfileRight`** associa `(profiles_id, name, rights)` onde `rights` é o
bitmask de [[EV-1-002 · Constantes globais e bitmask de direitos|EV-1-002]]. O direito efetivo de um usuário resulta do cruzamento
Perfil × Entidade (via `Profile_User`).

## Sustenta
- [[Perfis e Direitos (RBAC)]]
- [[Interface helpdesk vs central]]
