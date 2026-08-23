---
title: Identity Federation
aliases:
  - Federação de Identidade
tags:
  - security
  - iam
type: concept
status: evergreen
created: 2026-07-09
---
Identity Federation permite que usuários autenticados em um sistema utilizem suas credenciais para acessar outro sistema sem criar uma nova conta.

É a base do Single Sign-On (SSO).

```mermaid
graph LR

User --> IdP
IdP --> Token
Token --> Application
```

> [!info]
> A autenticação ocorre no Identity Provider (IdP), enquanto a aplicação apenas valida o token.

## Protocolos

- SAML
- OAuth 2.0
- OpenID Connect

## Benefícios

- Single Sign-On
- Centralização das identidades
- Melhor segurança
- Menor administração de usuários

## Veja também

- [[Single Sign-On (SSO)]]
- [[OAuth 2.0]]
- [[JSON Web Token (JWT)]]
- [[System Design MOC]]
- [[IAM]]
- [[Authentication]]
- [[Authorization]]
- [[Zero Trust]]