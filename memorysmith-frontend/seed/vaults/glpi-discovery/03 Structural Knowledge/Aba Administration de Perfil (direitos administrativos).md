---
title: Aba Administration de Perfil (direitos administrativos)
aliases: [Administration tab, Aba Administration]
tags: [perfis, permissoes, administracao, usuarios, entidades, regras, ldap]
type: component
status: confirmed
source: "[[EV-2-e1-005 · Aba Administration do perfil (direitos sobre usuários, entidades e regras)|EV-2-e1-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Aba Administration de Perfil (direitos administrativos)

Aba do perfil que governa permissões sobre **usuários, entidades e regras de negócio de tickets** (além das 7 [[Permissões padrão de objetos|permissões padrão]], não relistadas). As zonas indicam direitos [[Zonas de permissão (global vs local delegada)|globais vs delegados localmente]].

## User permissions
| Direito | Efeito |
|---|---|
| **Read Auth** | Adiciona no formulário do usuário o método de autenticação e a data da última sincronização |
| **Update auth & sync** | Exibe a aba *Synchronization* (troca método e força sync); adiciona botão *LDAP directory link* antes da lista de grupos; exibe aba *LDAP directory link* no grupo |
| **Add External** | Permite importar/sincronizar usuário; adiciona botão *...From an external source* antes da lista de usuários |

Estes direitos governam a [[Importação e sincronização de usuários (fluxo)]] e a [[Importação de grupos LDAP (fluxo)]].

## Entity permissions
- **Update Parameters** — modifica dados da aba *Assistance* na entidade.
- **Read Parameters** — visualiza a aba *Assistance* na entidade.

## Business rules for tickets (entity)
- **Parent Business** — exibe a aba *applied rules (entity name)* nas regras de negócio para tickets, listando todas as regras aplicadas das entidades pai. Ver [[Motor de Regras de Negócio (capacidade)]] e [[Motor de Regras (engine)]].
- Os elementos de *Dictionaries* seguem as 7 permissões padrão — ver [[Dicionário de dados (dictionary)]].

## Relações
- Conceito: [[Perfil de Usuário (conceito e composição)]].
- Processo: [[Administração de Controles de Acesso (processo)]].
