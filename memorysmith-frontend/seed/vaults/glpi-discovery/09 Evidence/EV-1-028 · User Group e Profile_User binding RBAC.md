---
title: EV-1-028 · User, Group e Profile_User (binding RBAC × entidade)
aliases: [EV-1-028]
tags: [evidence, dominio/admin, usuarios, rbac]
type: evidence
status: confirmed
source: "SRC-001 · src/User.php L69 · src/Group.php L45 · src/Group_User.php L45 · src/Profile_User.php L42"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-028 · User, Group e Profile_User (binding RBAC × entidade)

> [!quote] classes (grep confirmado)
> ```php
> class User extends CommonDBTM implements TreeBrowseInterface { ... }
> class Group extends CommonTreeDropdown { ... }          // grupos em árvore
> class Group_User extends CommonDBRelation { ... }        // pertença usuário↔grupo (N:N)
> class Profile_User extends CommonDBRelation { ... }      // usuário × perfil × entidade
> ```

- **User** — a conta; guarda credenciais internas, e-mails, idioma, autenticação de origem.
- **Group** — **árvore** de grupos (departamentos/times); membros via `Group_User` (com flags
  de grupo dinâmico/manual, delegação, gestor).
- **Profile_User** — a peça central do RBAC: liga **usuário → perfil → entidade** (com
  `is_recursive`). É por aqui que um usuário ganha um perfil numa entidade específica e suas
  sub-entidades. Complementa [[Perfis e Direitos (RBAC)]] e [[Modelo de Entidades (multi-tenancy)]].

## Sustenta
- [[Usuários e Grupos]]
- [[Perfis × Entidades (Profile_User)]]
