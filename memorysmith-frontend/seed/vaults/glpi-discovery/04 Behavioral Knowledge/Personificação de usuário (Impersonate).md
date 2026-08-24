---
title: Personificação de usuário (Impersonate)
aliases: [Impersonate, Impersonation, Assumir conta]
tags: [usuarios, impersonate, seguranca, depuracao, privilegio]
type: use-case
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-e1-001 · Ficha de Usuário — aba Users, impersonate e vcard|EV-2-e1-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Personificação de usuário (Impersonate)

Recurso que permite a uma conta **Super-Admin** (ou qualquer perfil com direitos de configuração) **assumir temporariamente** a conta de outro usuário sem conhecer sua senha, para depuração ou administração. Acionado por um ícone no topo da [[Ficha de Usuário (abas e visão geral)]].

## Comportamento
1. O administrador aciona o ícone de impersonate na ficha do usuário-alvo.
2. Um **banner permanente** indica o modo ativo e oferece saída.
3. Ao sair, o administrador recupera sua sessão como estava antes.
4. O histórico registra as ações com a nota: *"user (xxx) impersonated by admin (yyy)"*.

## Regra de segurança (anti-escalonamento)
> [!warning] Só é possível personificar usuários cujo perfil seja **igual ou menos privilegiado** que o do ator.
> Ex.: um técnico pode personificar usuários self-service, mas **não** admins — para evitar escalonamento de privilégio.

## Relações
- Governança de acesso: [[Administração de Controles de Acesso (processo)]], [[Perfis e Direitos (RBAC)]].
- Autenticação/sessão: [[Autenticação (Auth)]], [[Acesso e Login no GLPI (fluxo)]].
