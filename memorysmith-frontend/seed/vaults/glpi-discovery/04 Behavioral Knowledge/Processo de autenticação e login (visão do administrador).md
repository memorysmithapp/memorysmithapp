---
title: Processo de autenticação e login (visão do administrador)
aliases: [Processo de autenticação, Ordem de autenticação, Login process]
tags: [authentication, login, flow, provisioning]
type: flow
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-f2-001 · Processo geral de autenticação e criação on-the-fly|EV-2-f2-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Processo de autenticação e login (visão do administrador)

Descreve, do ponto de vista do administrador, o processo que o GLPI segue quando um usuário informa login e senha. Complementa a nota de código [[Fluxo de login e provisionamento]] e a visão de usuário [[Acesso e Login no GLPI (fluxo)]].

## Passo a passo
1. O usuário informa **login e senha**.
2. Se **ainda não registrado** no GLPI:
   1. O GLPI tenta os métodos configurados **um após o outro, na ordem `Internal > LDAP > IMAP > Other`**.
   2. Ao autenticar com sucesso, o usuário é **criado** e o **método usado é armazenado** com ele.
   3. Se nenhum método autentica → erro "usuário ou senha incorretos".
3. Se o usuário **já existia** (ou foi importado no passo anterior):
   1. O GLPI tenta autenticar **apenas com a última fonte** que teve sucesso.
   2. Se falhar → erro.
4. O **motor de autorização** é executado com a informação do usuário:
   - Se concede uma ou mais autorizações → o usuário acessa o GLPI.
   - Se nenhuma autorização → o usuário é conhecido pelo GLPI mas **não consegue logar**.

> [!note] Criação on-the-fly
> Para o GLPI criar usuários automaticamente das fontes externas ao logarem, isso deve ser habilitado em **Setup > Authentication > Setup**. Ver [[Fontes de autenticação externa (configuração)]].

A atribuição de autorizações é regida pelas Regras de Atribuição de Autorizações — ver [[Motor de Regras de Negócio (capacidade)]], [[Gestão de Usuários e Acesso (processo)]] e [[Administração de Controles de Acesso (processo)]].
