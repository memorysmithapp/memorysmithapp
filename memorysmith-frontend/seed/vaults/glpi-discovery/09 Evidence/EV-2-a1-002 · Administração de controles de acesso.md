---
title: EV-2-a1-002 · Administração de controles de acesso
aliases: [EV-2-a1-002]
tags: [evidence, doc, access-control, rbac, entities, profiles, authentication]
type: evidence
status: confirmed
source: "SRC-002 · source/first-steps/access-glpi.rst · Administering access controls"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-a1-002 · Administração de controles de acesso

> [!quote] source/first-steps/access-glpi.rst — Administering access controls
> "In GLPI each user does not have access to the same interface nor to the same functionalities. For each user, a specific context of use is determined, which grants them access only to the functionalities and information that is needed."

Pontos afirmados pelo doc:

- **Primeiro passo**: configurar o(s) método(s) de autenticação. GLPI gerencia usuários localmente no banco, mas recomenda-se delegar a autenticação a serviço externo como LDAP (ver *Configuring authentication methods*).
- **Usuários**: importação/criação, exclusão, sincronização, ativação/desativação e gestão de informações (email, telefone, etc.) são cobertas na administração de usuários.
- **Contexto de uso** de cada usuário é determinado por três meios: **grupos**, **entidades** e **perfis**.
  - *Grupos*: agrupam usuários por similaridade de competências ou unidades organizacionais.
  - *Entidades*: segmentam o parque de ativos, help desk, etc. em departamentos isolados entre si.
  - *Perfis*: conjuntos de permissões concedidos a usuários. "Multiple profiles can be given to a user but only one can be active at a time."
- **Regras**: é possível configurar *Rules for assigning authorizations to a user* para atribuir dinamicamente entidades, grupos e perfis a usuários.

> [!quote] source/first-steps/access-glpi.rst
> "Access to identity information about the user allows us to determine his or her authorizations."

## Sustenta
- [[Administração de Controles de Acesso (processo)]]
