---
title: EV-2-a1-010 · Gestão e recuperação de senha
aliases: [EV-2-a1-010]
tags: [evidence, doc, password, reset, security-policy, ldap]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · source/first-steps/manage-your-password.rst · Manage your password"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-a1-010 · Gestão e recuperação de senha

> [!quote] source/first-steps/manage-your-password.rst
> "The change password form can be found in user preferences. You must enter and confirm your password before validation. The administrator can disable this feature, so the change password area does not appear in this case."

Recuperação de senha esquecida:
> [!quote]
> "In the event that the user has forgotten their password, the possibility of resetting it is offered to them from the login page. **The link is only present if notifications are enabled**."

- Só usuários com **e-mail definido** no GLPI e que **não** autenticam via fonte externa (LDAP, mail server, etc.) podem usar a funcionalidade. Após pedir a renovação (informando o e-mail), o usuário recebe um e-mail com link para redefinir a senha.
> [!note]
> "If you use an external authentication source (such as LDAP, SSO, etc.), please reset your password from your identity provider."

- As senhas devem seguir a **política de segurança** definida; há verificação em tempo real da senha digitada (ver *security configuration tab*).

## Sustenta
- [[Gestão de Senha do Usuário]]
