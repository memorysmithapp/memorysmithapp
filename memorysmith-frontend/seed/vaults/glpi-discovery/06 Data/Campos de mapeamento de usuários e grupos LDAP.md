---
title: Campos de mapeamento de usuários e grupos LDAP
aliases: [Mapeamento LDAP, LDAP Users tab, LDAP Groups tab]
tags: [data, ldap, mapping, users, groups]
type: entity
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-f2-002 · Autenticação, sincronização e abas de configuração LDAP-AD|EV-2-f2-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos de mapeamento de usuários e grupos LDAP

Configuração das abas **Users** e **Groups** de um diretório em [[Diretório LDAP e Active Directory (configuração)]].

## Aba Users
Configura a **ligação entre os campos do diretório e os do GLPI**. A maioria dos campos é **mapeada automaticamente**, mas pode ser alterada. (A documentação apresenta o mapeamento por captura de tela `images/ldap-users.png`, sem enumerar cada par de campos.)

## Aba Groups
Configura o **método para recuperar grupos** do diretório LDAP. (Detalhe apresentado por captura de tela `images/ldap-groups.png`.)

> [!note] Lacuna de detalhe
> A documentação descreve estas abas em nível conceitual e por imagem; os pares específicos de mapeamento de atributo não estão enumerados no texto. O detalhe de campo a campo pertence à engenharia reversa do código ([[Usuários e Grupos]], [[Autenticação (Auth)]]).

Complementa [[Campos de configuração de diretório LDAP]] e [[Importação e sincronização de usuários LDAP (procedimento)]].
