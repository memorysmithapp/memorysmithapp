---
title: Gestão de Grupos (conceito e opções)
aliases: [Groups, Grupos, Gestão de grupos]
tags: [grupos, hierarquia, notificacoes, ldap, entidades, 2fa]
type: component
status: confirmed
source: "[[EV-2-e1-003 · Gestão de Grupos (hierarquia, opções e importação LDAP)|EV-2-e1-003]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Gestão de Grupos (conceito e opções)

Os **grupos** (`Administration > Groups`) agrupam usuários e/ou ativos. Podem ser organizados em **hierarquia** (ex.: `Management > Division > Service`) para facilitar navegação e busca. Complementa o modelo de código [[Usuários e Grupos]].

## Usos
- **Skills**: para o helpdesk (ex.: técnicos de rede, DBAs).
- **Grupos organizacionais**: ex.: todos os computadores de um departamento, ou conjunto de pessoas a notificar.

Em um item existem duas noções: o **Technical group** (grupo responsável pelo ativo) e o **Group** (grupo ao qual o item pertence). O grupo técnico permite atribuição automática de ticket a um grupo de técnicos (via categorias de ticket) e uso em [[Motor de Regras de Negócio (capacidade)|regras de negócio para tickets]].

## Opções de comportamento
- **Visible in a ticket** — grupo requerente e/ou de atribuição.
- **Can be notified** — destinatário de notificações.
- **Can be manager** — apenas para [[Projetos (Project)|projeto]].
- **Can contain** — ativos e/ou usuários.

> [!hint] Se todas as opções forem *No*, o grupo não aparece em nenhuma lista de seleção — útil para grupos mantidos só por histórico ou nós vazios da hierarquia.

## Gestores, entidade e atribuição
- Um grupo pode ter um ou mais **managers** (usados em notificações; configurados na aba *Users* do grupo).
- O grupo é anexado à **entidade** onde é criado e pode ser visível em subentidades — ver [[Modelo de Entidades (multi-tenancy)]] e [[Recursividade em entidades]].
- Atribuição usuário→grupo: **estática** (interface) ou **dinâmica** (extraída do LDAP).
- **Security**: a aba permite forçar (ou não) o uso de [[Configuração de MFA e 2FA|2FA]] para o grupo.

## Abas do grupo
Child groups · Used items · Managed items · LDAP directory link (só com "Auth and sync update") · Security · Users · Notifications · Created tickets · Problems · Changes · Notes · Historical.

## Relações
- Campos/opções: [[Campos e opções de Grupo]].
- Importação: [[Importação de grupos LDAP (fluxo)]].
- Aba na ficha do usuário: [[Atribuição de autorizações e grupos a um usuário (procedimento)]].
