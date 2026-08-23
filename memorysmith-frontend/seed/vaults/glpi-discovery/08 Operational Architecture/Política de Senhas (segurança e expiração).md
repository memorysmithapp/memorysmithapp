---
title: Política de Senhas (segurança e expiração)
aliases: [Security tab, Password policy, Política de senhas]
tags: [configuracao-geral, seguranca, senha, politica, operacao]
type: rule
status: confirmed
source: "[[EV-2-f1-012 · Política de senhas (segurança e expiração)|EV-2-f1-012]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Aba **Security** (Setup > General): parâmetros de segurança de senhas — política de **segurança** (força) e de **expiração**. Relaciona-se a [[Gestão de Senha do Usuário]], [[Autenticação (Auth)]] e [[Configuração de MFA e 2FA]].

## Password security policy
Aplicada somente se a **validação da política** estiver habilitada:
- Password security policy validation (interruptor mestre)
- Password minimum length
- Password need digit
- Password need uppercase character
- Password need lowercase character
- Password need symbol

## Password expiration policy
- Password expiration delay (in days) — pode ser **never** para desabilitar a expiração
- Password expiration notice time (in days)
- Delay before account deactivation (in days)

> [!note]
> Aplica-se a usuários com autenticação interna do GLPI (ver [[Usuários e Grupos]], [[Perfis e Direitos (RBAC)]]).
