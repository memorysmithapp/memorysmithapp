---
title: Grupo (campo de ativo)
aliases: [Group, Grupo]
tags: [campos-comuns, atores, grupo, dropdown, data]
type: field
maturity: evergreen
reviewed: false
source: "[[EV-2-g4-004 · Campos de atores (usuário, grupo, grupo e técnico responsáveis)|EV-2-g4-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Grupo (campo de ativo)

Campo comum que representa a **pertença** (membership) do objeto GLPI a um grupo — análogo ao campo [[Usuário (campo user do ativo)]]. Um grupo pode ser adicionado ou criado diretamente pelo campo; grupos vindos de AD/LDAP(S)/SCIM seguem procedimentos internos.

Na criação de um grupo definem-se, entre outros: **Child entities** (visível em sub-entidade — ver [[Recursividade em entidades]]), **Name**, **Code** (opcional), **Child of**, **Recursive membership** (membros passam a ser membros implícitos dos grupos filhos), visibilidade em ticket (requester/observer/assigned/task/notificável), se pode ser **manager** em projeto e se pode conter **Items** e/ou **Users**. Ao vincular usuários, define-se se cada um pode **Manage** o grupo e se tem direitos de **Delegatee** (abrir ticket para o grupo).

Baseia-se no modelo de [[Usuários e Grupos]].
