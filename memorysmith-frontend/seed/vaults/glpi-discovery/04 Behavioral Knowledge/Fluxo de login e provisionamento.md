---
title: Fluxo de login e provisionamento
aliases: [Login flow, provisionamento LDAP]
tags: [flow, autenticacao, dominio/admin]
type: flow
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-029 · Auth com múltiplos métodos e 2FA|EV-1-029]]"
  - "[[EV-1-030 · AuthLDAP diretório e sincronização|EV-1-030]]"
  - "[[EV-1-032 · Tipos de regra especializados|EV-1-032]]"
author: CAD Discovery
created: 2026-07-10
---

# Fluxo de login e provisionamento

Deriva de [[Autenticação (Auth)]] e [[Tipos de Regra|RuleRight]].

```mermaid
flowchart TD
    A[Credenciais / SSO] --> B{Fonte de identidade}
    B -- interna --> C[valida hash no banco]
    B -- LDAP/AD --> D[ldap_bind + busca no diretório]
    B -- IMAP --> E[valida no servidor de mail]
    B -- CAS/X509/OAuth --> F[valida token/cert]
    D --> G[cria/atualiza User\nmapeia atributos]
    C --> H{RuleRight}
    E --> H
    F --> H
    G --> H
    H -- atribui --> I[perfil + entidade + grupos]
    H -- nega --> X[denied_by_rule]
    I --> J{2FA habilitado?}
    J -- sim --> K[verifica TOTP]
    J -- não --> L[sessão iniciada]
    K --> L
    L --> M[perfil ativo + entidade ativa]
```
