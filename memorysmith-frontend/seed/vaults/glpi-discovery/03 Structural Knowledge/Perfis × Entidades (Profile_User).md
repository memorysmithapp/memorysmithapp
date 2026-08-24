---
title: Perfis × Entidades (Profile_User)
aliases: [Profile_User, RBAC binding, perfil entidade]
tags: [concept, seguranca, rbac, dominio/admin]
type: concept
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-1-028 · User Group e Profile_User binding RBAC|EV-1-028]]"
author: CAD Discovery
created: 2026-07-10
---

# Perfis × Entidades (Profile_User)

`Profile_User` é a peça que **conecta** as três dimensões do controle de acesso do GLPI:

**Usuário × Perfil × Entidade** (com `is_recursive`).

- Um mesmo usuário pode ter **perfis diferentes em entidades diferentes** (ex.: técnico na
  Filial SP, apenas solicitante na Matriz).
- `is_recursive` estende o perfil às **sub-entidades**.
- Na sessão, o usuário escolhe (ou herda) o **perfil ativo** e a **entidade ativa**; os
  métodos `can*` de [[CommonDBTM (Active Record)]] avaliam o direito nessa combinação.

Completa [[Perfis e Direitos (RBAC)]] (o que cada perfil pode) e
[[Modelo de Entidades (multi-tenancy)]] (onde). Pode ser **atribuído automaticamente** no
login por [[Tipos de Regra|RuleRight]].
