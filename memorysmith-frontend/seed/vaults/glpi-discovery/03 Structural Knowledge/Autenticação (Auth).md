---
title: Autenticação (Auth)
aliases: [Auth, Autenticação, LDAP, SSO, 2FA]
tags: [component, autenticacao, seguranca, dominio/admin]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-029 · Auth com múltiplos métodos e 2FA|EV-1-029]]"
  - "[[EV-1-030 · AuthLDAP diretório e sincronização|EV-1-030]]"
author: CAD Discovery
created: 2026-07-10
---

# Autenticação (Auth)

A classe `Auth` orquestra o **login** e suporta múltiplas **fontes de identidade**:

| Método | Const | Descrição |
|---|---|---|
| Interna | `DB_GLPI` | credencial no banco do GLPI |
| Mail | `MAIL` | IMAP (`AuthMail`) |
| LDAP/AD | `LDAP` | diretório (`AuthLDAP`) |
| SSO header | `EXTERNAL` | usuário injetado por proxy/SSO |
| CAS | `CAS` | Central Authentication Service |
| X.509 | `X509` | certificado cliente |
| API | `API` | token de API |
| Cookie | `COOKIE` | "lembrar-me" |

Recursos de segurança: **2FA (TOTP)** via `TOTPManager`, **expiração de senha**, bloqueio,
e um **servidor OAuth2** (`Glpi\OAuth`) para autorizar clientes/API.

A ordem de tentativa e o provisionamento (criar/atualizar User a partir do diretório) seguem
[[Fluxo de login e provisionamento]]. Configuração de diretórios em [[EV-1-030 · AuthLDAP diretório e sincronização|EV-1-030]].
