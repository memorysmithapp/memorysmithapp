---
title: Perfil de Usuário (conceito e composição)
aliases: [User profiles, Perfis, Profile]
tags: [perfis, rbac, permissoes, entidades, recursividade, dinamico]
type: concept
maturity: evergreen
reviewed: false
source: "[[EV-2-e1-004 · Perfis de usuário — conceito, 7 perfis pré-definidos e permissões padrão|EV-2-e1-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Perfil de Usuário (conceito e composição)

> [!quote] "Profile is central in GLPI configuration: profile is the key for users permissions granting and for securing and isolating data."

O **perfil** é o núcleo do RBAC do GLPI na ótica de administração — é a chave para conceder permissões e para **segurar e isolar** dados. É a face documental do modelo de código [[Perfis e Direitos (RBAC)]].

## Composição
Um perfil associa-se a:
- um **usuário**;
- uma **entidade**, de forma **recursiva** ou **dinâmica**.

Para propagar os direitos às **entidades filhas**, o perfil deve ser associado **recursivamente** (princípio da recursividade — ver [[Recursividade em entidades]] e [[Modelo de Entidades (multi-tenancy)]]). Um mesmo usuário pode ter **perfis diferentes** conforme a entidade — basta adicionar o perfil ao usuário para cada entidade em que ele deva diferir. Essa associação usuário×entidade×perfil é o [[Perfis × Entidades (Profile_User)]] do código.

## Abas de gestão do perfil
Sete abas correspondem aos menus do GLPI e governam as permissões:
- [[Permissões padrão de objetos|Assets]] (7 permissões padrão + *Internet*)
- [[Aba Assistance de Perfil (direitos de service desk)|Assistance]]
- **Life cycle** (permissões sobre o ciclo de status de tickets/problemas/mudanças — ver [[Matriz de ciclo de vida (transições de status por perfil)]])
- **Management** (7 permissões padrão; *Financial and administrative information* estende-se a objetos com dados financeiros)
- [[Aba Tools de Perfil (direitos de ferramentas)|Tools]]
- [[Aba Administration de Perfil (direitos administrativos)|Administration]]
- [[Aba Configuration de Perfil (direitos de configuração)|Configuration]]

Além delas: **Users** (entidades onde o perfil é atribuído; "D"=dinâmico, "R"=recursivo), Historical e All.

> [!note] A exibição da gestão de perfis **depende do perfil do usuário conectado** e pode variar.

## Relações
- Catálogo pré-instalado: [[Perfis pré-definidos do GLPI]].
- Direitos base: [[Permissões padrão de objetos]].
- Governança: [[Zonas de permissão (global vs local delegada)]], [[Administração de Controles de Acesso (processo)]].
- Atribuição na ficha do usuário: [[Atribuição de autorizações e grupos a um usuário (procedimento)]].
