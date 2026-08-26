---
title: Gestão de Usuários e Acesso (processo)
aliases: [IAM, gestão de acesso, provisionamento]
tags: [process, seguranca, dominio/admin]
type: process
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-028 · User Group e Profile_User binding RBAC|EV-1-028]]"
  - "[[EV-1-030 · AuthLDAP diretório e sincronização|EV-1-030]]"
  - "[[EV-1-032 · Tipos de regra especializados|EV-1-032]]"
author: CAD Discovery
created: 2026-07-10
---

# Gestão de Usuários e Acesso (processo)

Processo de administração de identidades e permissões.

## Fluxo
1. **Provisionamento** — usuários criados manualmente ou **importados/sincronizados** do LDAP/AD
   ([[EV-1-030 · AuthLDAP diretório e sincronização|EV-1-030]]); atributos mapeados para o `User`.
2. **Atribuição de acesso** — via [[Perfis × Entidades (Profile_User)]]: perfil por entidade,
   manual ou automático por **RuleRight** no login ([[Tipos de Regra]]).
3. **Grupos** — pertença manual ou dinâmica (`Group_User`), usada para atribuição e
   visibilidade.
4. **Governança** — expiração de senha, 2FA, bloqueio, e **revisão** de perfis.
5. **Desligamento** — desativação do usuário (mantém histórico/auditoria).

Ancorado em [[Usuários e Grupos]], [[Perfis e Direitos (RBAC)]] e
[[Modelo de Entidades (multi-tenancy)]].
