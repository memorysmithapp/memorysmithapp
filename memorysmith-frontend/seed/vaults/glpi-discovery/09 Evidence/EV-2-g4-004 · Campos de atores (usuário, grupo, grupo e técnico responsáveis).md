---
title: EV-2-g4-004 · Campos de atores (usuário, grupo, grupo e técnico responsáveis)
aliases: [EV-2-g4-004]
tags: [evidence, campos-comuns, atores, usuario, grupo, tecnico]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · tabs/common_fields/user.rst · User; tabs/common_fields/group.rst · Group; tabs/common_fields/group_in_charge.rst · Group in charge; tabs/common_fields/technician_in_charge.rst · Technician in charge"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-g4-004 · Campos de atores associados a um item

> [!quote] User (`user.rst`)
> "If the user who opened the session on the machine is also present in the GLPI database ... this field will be filled in. It will remain empty if the user does not exist in the database. You can add a user manually but it will be locked (by default) to prevent it being updated at a later date." Preenchido pelo inventário (base interna ou fonte externa); adição manual bloqueia o campo.

> [!quote] Group (`group.rst`)
> "This field, like the user field, corresponds to the membership of the GLPI object. You can add a group manually or create a group directly by this field." Ao criar grupo: **Child entities**, **Name**, **Code** (opcional), **Child of**, **Recursive membership** (membros tornam-se membros implícitos dos grupos filhos), visibilidade em ticket (requester/observer/assigned/task/notificável), possibilidade de ser **manager** em projeto, e se pode conter **Items** e/ou **Users**. Ao adicionar usuários: definir se o usuário pode **Manage** o grupo e se tem direitos de **Delegatee** (abrir ticket para o grupo). Grupos de AD/LDAP(S)/SCIM seguem procedimentos internos.

> [!quote] Group in charge (`group_in_charge.rst`)
> "A group in charge can modify the information of the computer and his elements (status, computer type, etc.)." Mesmo procedimento de criação/gestão de grupo do campo Group, porém no papel de **responsável** pelo item.

> [!quote] Technician in charge (`technician_in_charge.rst`)
> "A technician in charge can modify the information of the computer and his elements (status, computer type, etc.)." "A technician is a person with a technician profile or higher." O técnico responsável vê o material que gerencia em **Administration > Users**, na aba **managed items** da ficha do usuário. Usuários de AD/LDAP(S)/SCIM seguem procedimentos internos.

## Sustenta
- [[Usuário (campo user do ativo)]]
- [[Grupo (campo de ativo)]]
- [[Grupo responsável (group in charge)]]
- [[Técnico responsável (technician in charge)]]
