---
title: EV-1-030 · AuthLDAP — diretório e sincronização
aliases: [EV-1-030]
tags: [evidence, dominio/admin, ldap]
type: evidence
status: confirmed
source: "SRC-001 · src/AuthLDAP.php L59 · src/AuthMail.php L41"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-030 · AuthLDAP — diretório e sincronização

> [!quote] classes (grep confirmado)
> ```php
> class AuthLDAP extends CommonDBTM { ... }  // configuração de um diretório LDAP/AD
> class AuthMail extends CommonDBTM { ... }   // configuração de servidor IMAP para auth
> ```

**AuthLDAP** guarda a configuração de cada diretório (host, base DN, filtros, mapeamento de
campos LDAP → campos do User). Suporta:
- **Importação/sincronização** de usuários (e grupos) do diretório, manual ou por cron.
- **Mapeamento de atributos** (nome, e-mail, telefone, localização…) para o `User`.
- Réplicas (`AuthLdapReplicate`) para alta disponibilidade.
- Alimenta as **RuleRight** ([[Tipos de Regra]]) que atribuem perfil/entidade a partir de
  atributos LDAP no login.

**AuthMail** permite autenticar contra um servidor IMAP.

## Sustenta
- [[Autenticação (Auth)]]
- [[Fluxo de login e provisionamento]]
