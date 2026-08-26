---
title: Importação de grupos LDAP (fluxo)
aliases: [Import groups, Importar grupos LDAP]
tags: [grupos, importacao, ldap, entidades, fluxo]
type: flow
maturity: evergreen
reviewed: false
source: "[[EV-2-e1-003 · Gestão de Grupos (hierarquia, opções e importação LDAP)|EV-2-e1-003]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Importação de grupos LDAP (fluxo)

Em `Administration > Groups > LDAP directory link` é possível importar grupos de um diretório, se **autenticação externa** é usada e o direito **"Auth and sync update"** está no perfil.

## Fluxo
1. Acionar *LDAP directory link* no topo da lista de grupos.
2. Se houver vários diretórios, escolher um; caso contrário o formulário de busca é direto.
3. Conforme a configuração de busca, aparecem **Search filter in groups** e/ou **User search filter** para refinar a lista a importar.
4. Em multi-entidades, selecionar a **entidade destino** e a **visibilidade** nas subentidades.
5. A atribuição de usuários aos grupos ocorre de forma **automática** (dinâmica).

## Restrições
> [!warning]
> - A importação de grupos **não** pode ser filtrada por entidade.
> - **Não** existe função de sincronização de grupos. Para atualizar os membros a partir do diretório, é preciso **ressincronizar os usuários** — ver [[Importação e sincronização de usuários (fluxo)]] e [[Sincronização LDAP de usuários (CLI e manutenção)]].

A aba **LDAP directory link** do grupo (visível só com "Auth and sync update") reúne a informação que permite ao GLPI localizar o grupo e seus usuários no diretório.

## Relações
- Conceito: [[Gestão de Grupos (conceito e opções)]].
- Autenticação: [[Autenticação (Auth)]], [[Autenticação e Single Sign-On (processo)]].
