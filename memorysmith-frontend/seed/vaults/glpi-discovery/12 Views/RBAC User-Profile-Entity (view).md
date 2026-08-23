---
title: RBAC User×Profile×Entity (view)
aliases: [RBAC view, Profile_User diagram, "RBAC User×Profile×Entity (view)"]
tags: [view, seguranca, rbac, dominio/admin]
type: view
status: confirmed
source: "[[EV-1-028 · User Group e Profile_User binding RBAC|EV-1-028]]"
author: CAD Discovery
created: 2026-07-10
---

# RBAC User×Profile×Entity (view)

Modelo de controle de acesso (deriva de [[Perfis × Entidades (Profile_User)]]).

```mermaid
erDiagram
    USER ||--o{ PROFILE_USER : possui
    PROFILE ||--o{ PROFILE_USER : concede
    ENTITY ||--o{ PROFILE_USER : em
    PROFILE ||--o{ PROFILERIGHT : direitos
    USER ||--o{ GROUP_USER : membro
    GROUP ||--o{ GROUP_USER : de
    ENTITY ||--o{ ENTITY : arvore_pai
    PROFILE_USER {
        int users_id
        int profiles_id
        int entities_id
        bool is_recursive
    }
    PROFILERIGHT {
        int profiles_id
        string name
