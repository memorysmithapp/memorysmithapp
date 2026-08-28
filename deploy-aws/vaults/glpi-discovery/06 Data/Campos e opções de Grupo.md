---
title: Campos e opções de Grupo
aliases: [Group fields, Campos do grupo]
tags: [grupos, campos, dados, opcoes]
type: table
maturity: evergreen
reviewed: false
source: "[[EV-2-e1-003 · Gestão de Grupos (hierarquia, opções e importação LDAP)|EV-2-e1-003]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos e opções de Grupo

Opções de comportamento configuráveis em um grupo (`Administration > Groups`):

| Opção | Efeito |
|---|---|
| **Visible in a ticket** | Grupo pode ser requerente e/ou de atribuição em tickets |
| **Can be notified** | Grupo pode ser destinatário de notificações |
| **Can be manager** | Grupo pode ser gestor — apenas para projeto |
| **Can contain** | Grupo pode conter ativos e/ou usuários |

- **Hierarquia**: grupos podem ter subgrupos (aba *Child groups*), formando estrutura em árvore.
- **Manager(s)**: um ou mais usuários gestores (definidos na aba *Users*, marcando *manager*).
- **Entidade/visibilidade**: grupo anexado à entidade de criação, com visibilidade opcional nas subentidades.
- **Dynamic**: indica que a associação de membros vem do diretório LDAP (vs. estática pela interface).
- **2FA**: a aba *Security* permite forçar 2FA para o grupo.

> [!note] Se todas as quatro opções acima forem *No*, o grupo não aparece em listas de seleção.

## Relações
- Conceito: [[Gestão de Grupos (conceito e opções)]].
- Modelo de código: [[Usuários e Grupos]].
