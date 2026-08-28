---
title: Perfis e Direitos (RBAC)
aliases: [Perfis, Direitos, RBAC, Profile, ProfileRight]
tags: [concept, seguranca, dominio/foundation]
type: concept
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-002 · Constantes globais e bitmask de direitos|EV-1-002]]"
  - "[[EV-1-006 · Profile e ProfileRight definem RBAC helpdesk vs standard|EV-1-006]]"
author: CAD Discovery
created: 2026-07-10
---

# Perfis e Direitos (RBAC)

O controle de acesso do GLPI é baseado em **perfis** (`Profile`) que agrupam **direitos**
(`ProfileRight`) por tipo de objeto.

## Direitos como bitmask
Cada direito é uma permissão em **bitmask** (ver [[EV-1-002 · Constantes globais e bitmask de direitos|EV-1-002]]):
`READ=1`, `UPDATE=2`, `CREATE=4`, `DELETE=8`, `PURGE=16` (`ALLSTANDARDRIGHT=31`),
mais `READNOTE`, `UPDATENOTE`, `UNLOCK`, e os restritos `READ_ASSIGNED`, `UPDATE_ASSIGNED`,
`READ_OWNED`, `UPDATE_OWNED`. Uma linha `ProfileRight (profiles_id, name, rights)` guarda o
bitmask combinado para cada `name` (ex.: `ticket`, `computer`).

## Perfil e interface
Um `Profile` define também a **interface**: `helpdesk` (simplificada, restrita aos
`$helpdesk_rights` — abrir/acompanhar chamados, KB, reservas) ou `central` (completa).
Ver [[Interface helpdesk vs central]].

## Direito efetivo
O direito de um usuário é resolvido pelo cruzamento **Perfil × Entidade** (via `Profile_User`)
e é aplicado nos métodos `can*` de [[CommonDBTM (Active Record)]]. Direitos `*_ASSIGNED`/
`*_OWNED` sustentam cenários onde o técnico só vê/edita chamados atribuídos a ele ou ao seu
grupo.

> [!question] A aprofundar (Módulo 5)
> Direitos específicos por itemtype, direitos de entidade, e o mecanismo de tradução
> nome→bitmask na tela de edição de perfil.
