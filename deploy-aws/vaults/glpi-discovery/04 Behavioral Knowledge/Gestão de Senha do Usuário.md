---
title: Gestão de Senha do Usuário
aliases: [Manage password, Troca de senha, Reset de senha, Password reset]
tags: [flow, password, reset, security-policy, ldap]
type: flow
maturity: evergreen
reviewed: false
source: "[[EV-2-a1-010 · Gestão e recuperação de senha|EV-2-a1-010]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Gestão de Senha do Usuário

## Troca de senha
O formulário de troca de senha fica nas [[Personalização da Experiência do Usuário (capacidade)|preferências do usuário]]. É preciso digitar e confirmar a nova senha antes da validação. O **administrador pode desabilitar** esse recurso — nesse caso a área de troca de senha não aparece.

## Recuperação de senha esquecida
A redefinição é oferecida a partir da **página de login**. O link só está presente **se as notificações estiverem habilitadas**. Apenas usuários com **e-mail definido** no GLPI e que **não** autenticam por fonte externa (LDAP, mail server, etc.) podem usá-lo: após informar o e-mail, o usuário recebe uma mensagem com link para redefinir a senha.

> [!note]
> Com fonte de autenticação externa (LDAP, SSO, etc.), a senha deve ser redefinida no provedor de identidade, não no GLPI.

## Política de segurança
As senhas devem seguir a **política de segurança** definida; há verificação **em tempo real** da senha digitada (aba de configuração de segurança).

## Relações
- Parte de: [[Personalização da Experiência do Usuário (capacidade)]]; precede [[Acesso e Login no GLPI (fluxo)]].
- Ponte de código: [[Autenticação (Auth)]], [[Notificações (e-mail e canais)]], [[Fluxo de login e provisionamento]].
