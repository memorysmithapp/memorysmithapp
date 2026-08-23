---
title: JSON Web Token (JWT)
aliases:
  - JWT
  - JSON Web Token
  - Bearer Token
tags:
  - security
  - identity
  - api
  - system-design
type: concept
status: evergreen
source: RFC 7519 JSON Web Token — IETF, 2015; OWASP JWT Cheat Sheet
author: IETF · OWASP
created: 2026-07-25
---
> [!abstract]
> JWT é um formato padrão para representar declarações (*claims*) em um token compacto e **assinado digitalmente**, de modo que quem o recebe possa verificar sua integridade sem consultar quem o emitiu.

## Conceito

Um JWT tem três partes separadas por ponto, cada uma codificada em Base64URL:

```text
eyJhbGciOiJIUzI1NiJ9 . eyJzdWIiOiIxMjMifQ . dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1
└──── header ────┘   └──── payload ────┘   └──────── signature ────────┘
```

| Parte | Conteúdo |
|---|---|
| **Header** | Tipo do token e algoritmo de assinatura |
| **Payload** | As claims: quem é o sujeito, quem emitiu, quando expira, permissões |
| **Signature** | Assinatura das duas partes anteriores, feita com a chave do emissor |

A assinatura é o que garante que ninguém alterou o conteúdo sem que o receptor perceba.

## Por que importa

Como o token carrega as claims **e** a prova de que não foi adulterado, o servidor não precisa manter estado de sessão: basta validar a assinatura. É o que torna a autenticação compatível com serviços *stateless* e escaláveis horizontalmente — o problema que [[Gerenciamento de Sessão]] com cookie de sessão não resolve bem fora do navegador.

## Armadilhas

> [!warning] O payload não é secreto
> Base64 é **codificação, não cifragem**. Qualquer pessoa com o token lê o conteúdo. Nunca coloque dado sensível no payload de um JWT assinado — para confidencialidade é preciso JWE, não JWS.

> [!warning] `alg: none` e confusão de algoritmo
> A vulnerabilidade clássica: o servidor confia no campo `alg` do header do próprio token. Um atacante troca para `none` e a assinatura deixa de ser verificada. O servidor deve **fixar** o algoritmo esperado, nunca lê-lo do token.

> [!warning] Revogar é o problema não resolvido
> A vantagem — não precisar consultar o emissor — é a desvantagem: um JWT válido continua válido até expirar, mesmo que o usuário tenha sido desligado. As mitigações são prazo curto com refresh token, ou uma lista de revogação, que reintroduz o estado que o JWT prometia eliminar.

## Fonte

- IETF, [RFC 7519 — JSON Web Token](https://datatracker.ietf.org/doc/html/rfc7519), 2015
- OWASP, [JSON Web Token Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html)

## Veja também

- [[OAuth 2.0]]
- [[Single Sign-On (SSO)]]
- [[Gerenciamento de Sessão]]
- [[Segurança de API]]
- [[Identity Federation]]
- [[System Design MOC]]
