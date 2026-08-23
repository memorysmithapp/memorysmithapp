---
title: Usuários e Grupos
aliases: [User, Group, Usuários, Grupos]
tags: [entity, usuarios, dominio/admin]
type: entity
status: confirmed
source: "[[EV-1-028 · User Group e Profile_User binding RBAC|EV-1-028]]"
author: CAD Discovery
created: 2026-07-10
---

# Usuários e Grupos

- **User** — a conta de pessoa. Guarda credenciais internas (quando `DB_GLPI`), e-mails,
  telefone, idioma, fuso, e a **origem de autenticação** (interna/LDAP/…). Pode ser
  solicitante, técnico ou administrador conforme perfil.
- **Group** — **árvore** de grupos (departamentos, times de suporte). Membros via `Group_User`,
  que distingue grupo **manual** vs **dinâmico** (preenchido por regra/LDAP), além de flags de
  **gestor** e **delegação**.

Grupos são usados como **atores** em chamados ([[Modelo de Atores ITIL]]), destinatários de
atribuição/escalonamento e alvos de visibilidade (KB, reservas).

O acesso efetivo do usuário vem do cruzamento com perfis e entidades —
ver [[Perfis × Entidades (Profile_User)]].
