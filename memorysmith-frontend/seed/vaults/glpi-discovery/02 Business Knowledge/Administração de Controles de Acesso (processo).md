---
title: Administração de Controles de Acesso (processo)
aliases: [Access control, Controle de acesso, Contexto de uso]
tags: [process, access-control, rbac, entities, profiles, groups, authentication]
type: process
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-a1-002 · Administração de controles de acesso|EV-2-a1-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Administração de Controles de Acesso (processo)

O GLPI determina, para cada usuário, um **contexto de uso** específico que concede acesso apenas às funcionalidades e informações necessárias — por isso usuários diferentes veem interfaces e funções diferentes. A determinação das autorizações parte das informações de identidade do usuário.

## Passos do processo (visão do administrador)
1. **Configurar método(s) de autenticação** — primeiro passo. O GLPI gerencia usuários localmente no banco, mas recomenda delegar a autenticação a serviço externo como LDAP. Ver ponte de código [[Autenticação (Auth)]] e [[Autenticação e Single Sign-On (processo)]].
2. **Gerir usuários** — importação/criação, exclusão, sincronização, ativação/desativação e informações (email, telefone). Ponte: [[Usuários e Grupos]], [[Gestão de Usuários e Acesso (processo)]].
3. **Definir os meios de contexto de uso** — três eixos:
   - **Grupos** — agrupam usuários por competências ou unidades organizacionais.
   - **Entidades** — segmentam o parque, help desk, etc. em departamentos isolados. Ponte: [[Modelo de Entidades (multi-tenancy)]].
   - **Perfis** — conjuntos de permissões; vários perfis por usuário, mas **apenas um ativo por vez**. Ponte: [[Perfis e Direitos (RBAC)]], [[Perfis × Entidades (Profile_User)]].
4. **Regras de atribuição de autorizações** — atribuem dinamicamente entidades, grupos e perfis aos usuários. Ponte: [[Motor de Regras de Negócio (capacidade)]], [[Tipos de Regra]].

> [!note]
> Este processo, descrito na documentação do usuário, corresponde do lado de negócio ao modelo de acesso implementado no código (RBAC + entidades + grupos). É a "porta de entrada" que condiciona [[Interface Padrão (Standard)]] vs [[Interface Simplificada (Helpdesk-Self-Service)]].

## Relações
- Governa: [[Acesso e Login no GLPI (fluxo)]].
- Ponte de código: [[Perfis e Direitos (RBAC)]], [[Modelo de Entidades (multi-tenancy)]], [[Autenticação (Auth)]], [[Usuários e Grupos]].
