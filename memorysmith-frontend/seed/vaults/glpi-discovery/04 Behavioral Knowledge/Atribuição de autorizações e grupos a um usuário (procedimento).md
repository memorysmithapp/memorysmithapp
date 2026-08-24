---
title: Atribuição de autorizações e grupos a um usuário (procedimento)
aliases: [Authorizations tab, Aba Authorizations, Atribuir perfil ao usuário]
tags: [usuarios, autorizacoes, perfis, grupos, entidades, recursivo, dinamico, acoes-massivas]
type: use-case
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-e1-009 · Aba Authorizations da ficha de usuário|EV-2-e1-009]]"
  - "[[EV-2-e1-010 · Aba Groups da ficha de usuário|EV-2-e1-010]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Atribuição de autorizações e grupos a um usuário (procedimento)

Nas abas **Authorizations** e **Groups** da [[Ficha de Usuário (abas e visão geral)|ficha de usuário]], o administrador concede acesso e vincula o usuário a grupos.

## Aba Authorizations
Uma **autorização** são os direitos/permissões atribuídos a usuários ou grupos para acessar recursos (tickets, ativos, orçamentos etc.); é gerida via **perfis** e garante segurança, confidencialidade e distribuição de responsabilidades. Uma aba-resumo exibe as autorizações já atribuídas.

- **Adicionar autorização**: selecionar a **entidade**, o **perfil** e a **recursão**.
- **Excluir autorização**: usar a **ação massiva**.

Abreviações exibidas:
- **R = Recursive** — o perfil tem acesso a todas as entidades filhas anexadas.
- **D = Dynamic** — a autorização foi adicionada por uma **regra de autorização**; se a regra é modificada, a autorização muda no próximo login do usuário.

Materializa a associação [[Perfis × Entidades (Profile_User)]] e o conceito de [[Perfil de Usuário (conceito e composição)]].

## Aba Groups
Permite gerir os grupos do usuário (se as próprias permissões permitirem). A tabela mostra, por grupo, o nome, se é **dinâmico** (ligado a diretório) e se o usuário é *delegatee* ou *manager*.

- **Adicionar grupo**: selecionar o grupo no dropdown, definir se o usuário pode gerir o grupo, e clicar em *Add*. Requer o direito de modificar a autorização do usuário.
- **Excluir grupo**: usar **ações massivas**.

> [!note] Um usuário que é **manager** de um grupo tem direito de modificá-lo — pode adicionar e excluir usuários desse grupo.

## Relações
- Grupos: [[Gestão de Grupos (conceito e opções)]].
- Regras de autorização (motor): [[Motor de Regras de Negócio (capacidade)]], [[Tipos de Regra]].
- Ações massivas: [[Ações em massa (massive actions)]].
- Processo: [[Administração de Controles de Acesso (processo)]], [[Gestão de Usuários e Acesso (processo)]].
