---
title: EV-2-e1-005 · Aba Administration do perfil (direitos sobre usuários, entidades e regras)
aliases: [EV-2-e1-005]
tags: [evidence, perfis, permissoes, administracao, usuarios, entidades, regras]
type: evidence
status: confirmed
source: "SRC-002 · modules/administration/profiles/administrationtab.rst · Administration permissions"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-e1-005 · Aba Administration do perfil (direitos sobre usuários, entidades e regras)

> [!quote] Zonas de permissão (administrationtab.rst)
> As 7 permissões padrão não são listadas aqui. Algumas permissões aplicam-se **globalmente** ao GLPI, outras podem ser **delegadas localmente** — indicado pela cor das zonas de permissão (ex.: perfis são definidos para todas as entidades; regras de negócio podem variar por entidade).

> [!quote] User permissions
> - **Read Auth**: adiciona no formulário do usuário um campo indicando o método de autenticação e a data da última sincronização.
> - **Update auth & sync**: exibe a aba *Synchronization* no usuário (troca de método de autenticação e força sincronização); adiciona o botão *LDAP directory link* antes da lista de grupos; exibe a aba *LDAP directory link* no grupo.
> - **Add External**: permite importar/sincronizar um usuário; adiciona o botão *...From an external source* antes da lista de usuários.

> [!quote] Entity e Business rules permissions
> Entity: **Update Parameters** (modifica dados da aba *Assistance* na entidade); **Read Parameters** (visualiza a aba *Assistance* na entidade). Business rules for tickets (entity): **Parent Business** exibe a aba *applied rules (entity name)* nas regras de negócio para tickets, listando todas as regras aplicadas das entidades pai. Os elementos da parte *Dictionaries* seguem as 7 permissões padrão.

## Sustenta
- [[Aba Administration de Perfil (direitos administrativos)]]
- [[Zonas de permissão (global vs local delegada)]]
