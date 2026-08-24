---
title: EV-2-e2-011 · Regras de atribuição de autorizações ao usuário
aliases: [EV-2-e2-011]
tags: [evidence, regras, autorizacoes, ldap, entidade, perfil, doc]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/administration/rules/userauthorizations.rst · Rules for assigning authorizations to a user"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] Documentação (userauthorizations.rst)
> "GLPI has a dynamic authorization engine which is based on external authentication sources. An authorization in GLPI results from the attribution of permissions over a scope (one or more entities); it is the **joint membership to a profile and to an entity**."

- Autorizações podem ser atribuídas **estaticamente** (usuário → perfil numa entidade), mas o método **recomendado** é o motor de regras de atribuição de entidade e permissões, usando **autenticação externa**.
- `.. note::` se não houver LDAP, POP ou IMAP configurado, o menu não aparece em Administration > Rules.
- O motor **executa todas as regras** e não para na primeira que se aplica → várias regras atribuem autorizações diferentes ao mesmo usuário. Um usuário com várias autorizações pode **trocar de perfil e de contexto de entidade** durante a sessão.

**Default profile**: se um perfil padrão está definido e uma regra de atribuição não inclui perfil, o padrão é usado. Sem perfil padrão, o usuário é importado **sem autorização** (nem entidade nem perfil); só o super-admin o vê na entidade raiz.

**Autorizações baseadas em servidor de e-mail (IMAP/POP)**: o login IMAP/POP e a URL do servidor podem ser critérios. Usuários criados on-the-fly no login (não há import em massa do servidor de e-mail). Subtipos: por **URL do servidor de e-mail** (ex.: `imap.exemple.be` → entidade Belgium); por **identificador de e-mail** (ex.: identificador termina com `exemple.be`). O domínio de e-mail da entidade é definido na aba *Advanced information* da entidade.

**Autorizações baseadas em diretórios LDAP**: atributos LDAP como fonte.
- *Baseadas em unidades organizacionais (ou)*: cada `ou` gera regra de atribuição a entidade; usa-se DistinguishedName. Regra **estática** (por entidade) ou **adaptativa** (uma única regra com regex `/(ou=.*)/` + ação "assign entity from LDAP, value from regular expression `#0`"). O motor compara o `ou` extraído do DN ao atributo "LDAP information representing the entity" da entidade.
- *Baseadas em grupos/atributos do usuário*: perfis e entidades definidos como grupos LDAP; a informação pode estar no objeto usuário (suficiente) ou no objeto grupo (requer configurar grupos LDAP e vínculo automático). Ex.: critério "Group directory LDAP is post-only" → ação "Profile assign post-only"; "Group directory LDAP is paris" → "Entity assign Exemple>France>Paris".
- `.. warning::` o cálculo de autorizações é feito **após executar todas as regras**: o produto de uma regra que atribui só entidade e outra que atribui só perfil define a autorização; 2 entidades + 1 perfil → 2 autorizações.

**Fontes mistas**: regras podem usar OU (organizational units) para entidade e grupos para perfil. Critérios LDAP adicionais podem ser criados (nome, atributo LDAP, comentário).

## Sustenta
- [[Regras de atribuição de autorizações ao usuário]]
