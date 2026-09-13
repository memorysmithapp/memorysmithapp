---
title: EV-1-029 · Auth com múltiplos métodos e 2FA
aliases: [EV-1-029]
tags: [evidence, dominio/admin, autenticacao, seguranca]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-001 · src/Auth.php L55–115 · Glpi\\Security\\TOTPManager · src/Glpi/OAuth/*"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-029 · Auth com múltiplos métodos e 2FA

> [!quote] `src/Auth.php`
> ```php
> class Auth extends CommonGLPI {
>     public $denied_by_rule = false;   // login pode ser negado por regra
>     public $password_expired = false;
>     // métodos de autenticação (L103–115):
>     const DB_GLPI=1; const MAIL=2; const LDAP=3; const EXTERNAL=4;
>     const CAS=5; const X509=6; const API=7; const COOKIE=8;
> }
> // usa Glpi\Security\TOTPManager (2FA/TOTP) e ldap_bind()
> ```

O `Auth` orquestra o **login** e suporta **8 fontes de identidade**: base interna (`DB_GLPI`),
**IMAP/mail** (`MAIL`), **LDAP/AD** (`LDAP`), **SSO por header** (`EXTERNAL`), **CAS**, **X.509**
(certificado), **API token** e **cookie**. Suporta **2FA (TOTP)** via `TOTPManager` e um
**servidor OAuth2** (`Glpi\OAuth`). O login pode ser **negado por regra** (`denied_by_rule`) e
há **expiração de senha**.

## Sustenta
- [[Autenticação (Auth)]]
- [[Autenticação e Single Sign-On (processo)]]
