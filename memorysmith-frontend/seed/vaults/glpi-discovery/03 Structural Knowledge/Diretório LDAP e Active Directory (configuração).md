---
title: Diretório LDAP e Active Directory (configuração)
aliases: [LDAP, Active Directory, AD, Diretório LDAP]
tags: [authentication, ldap, active-directory, configuration]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-f2-002 · Autenticação, sincronização e abas de configuração LDAP-AD|EV-2-f2-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Diretório LDAP e Active Directory (configuração)

O GLPI conecta-se a um ou mais **diretórios LDAP** (compatíveis LDAP v3, incluindo o **Active Directory** da Microsoft) para autenticar usuários, controlar acesso, recuperar informação pessoal e importar grupos. Visão de administrador de [[Autenticação (Auth)]].

## Características
- Sem limite de diretórios, mas quanto mais, mais lenta a busca de um novo usuário.
- Requer o módulo LDAP do PHP instalado (senão nenhuma configuração LDAP é visível).
- Suporta **LDAPS** (prefixo `ldaps://`, porta padrão 636).
- Um **template de pré-configuração Active Directory** pré-preenche vários campos.

## Abas de configuração do diretório
- **LDAP directory** — parâmetros de conexão e campos de identificação (ver [[Campos de configuração de diretório LDAP]]).
- **Test** — testa a conexão ("Connection test successful").
- **Users** — mapeamento entre campos do diretório e do GLPI (ver [[Campos de mapeamento de usuários e grupos LDAP]]).
- **Groups** — método de recuperação de grupos.
- **Advanced Information** — fuso horário, limite de registros, paginação (Page size, Maximum number of results).
- **Replicates** — servidores LDAP réplica (mesmos dados, endereço diferente) usados **apenas quando a conexão ao servidor principal se perde**; declarados com Name, Server, Port, Timeout; sem limite.

O processo de autenticação e sincronização é detalhado em [[Importação e sincronização de usuários LDAP (procedimento)]]. O controle de acesso baseia-se nas Regras de Atribuição de Autorizações — ver [[Motor de Regras de Negócio (capacidade)]].
