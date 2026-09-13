---
title: Regras de atribuição de autorizações ao usuário
aliases: [User authorizations, Regras de autorização, Entity and rights assignment rules]
tags: [regras, autorizacoes, ldap, perfil, entidade, autenticacao, doc]
type: rule
maturity: evergreen
reviewed: false
source: "[[EV-2-e2-011 · Regras de atribuição de autorizações ao usuário|EV-2-e2-011]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

O GLPI tem um **motor de autorização dinâmico** baseado em fontes de autenticação externas. Uma **autorização** é a associação conjunta de um **perfil** com uma **entidade** (escopo de uma ou mais entidades).

## Estático vs. dinâmico
- Atribuição **estática**: usuário → perfil numa entidade (possível, mas não recomendado).
- Atribuição **dinâmica** (recomendada): regras de atribuição de entidade e permissões, usando autenticação externa. Sem LDAP/POP/IMAP configurado, o menu não aparece.

O motor **executa todas as regras** (não para na primeira) → múltiplas autorizações ao mesmo usuário, que pode alternar perfil/entidade durante a sessão.

## Perfil padrão
Com perfil padrão definido e regra sem atribuição de perfil, usa-se o padrão. Sem perfil padrão, o usuário é importado **sem autorização** (visível só ao super-admin na entidade raiz).

## Fontes de critério
- **Servidor de e-mail (IMAP/POP)**: login e URL do servidor como critérios; usuários criados on-the-fly no login (sem import em massa). Subtipos por URL do servidor e por identificador de e-mail (domínio).
- **Diretório LDAP**: atributos LDAP como fonte.
  - Por **unidades organizacionais (ou)**: regra estática por entidade ou **adaptativa** (regex `/(ou=.*)/` + "assign entity from LDAP #0"); casa o `ou` do DN com o atributo "LDAP information representing the entity" da entidade (definido na aba *Advanced information* — ver [[Abas de configuração da Entidade]]).
  - Por **grupos/atributos** do usuário: perfis e entidades como grupos LDAP; informação no objeto usuário (suficiente) ou no objeto grupo (requer configurar grupos e vínculo automático).
- **Fontes mistas**: OUs para entidade + grupos para perfil; critérios LDAP adicionais.

> [!important] Cálculo das autorizações
> O cálculo ocorre **após executar todas as regras**: o produto de uma regra que atribui só entidade e outra que atribui só perfil define a autorização. 2 entidades + 1 perfil → 2 autorizações.

> [!note] Ponte doc×código
> Relaciona-se com [[Perfis × Entidades (Profile_User)]], [[Perfis e Direitos (RBAC)]], [[Autenticação (Auth)]] e [[Fluxo de login e provisionamento]].
