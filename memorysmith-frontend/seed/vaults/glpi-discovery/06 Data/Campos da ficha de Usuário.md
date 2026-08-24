---
title: Campos da ficha de Usuário
aliases: [User fields, Campos do usuário]
tags: [usuarios, campos, dados, formulario, ldap]
type: table
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-e1-001 · Ficha de Usuário — aba Users, impersonate e vcard|EV-2-e1-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos da ficha de Usuário

Campos do formulário de exibição do usuário. Campos marcados com **(\*)** não podem ser modificados manualmente se o usuário foi importado por um provedor (LDAP, SCIM etc.).

## User Information
| Campo | Semântica |
|---|---|
| **Login** (\*) | Usado para logar no GLPI |
| **Surname** (\*) | Sobrenome |
| **Firstname** | Nome |
| **Timezone** | Padrão "*use server configuration*" |
| **Active** | Conta ativa/inativa |
| **Valid since** / **Valid until** | Janela de validade da conta |
| **Authentication** (\*) | Fonte de autenticação (BD interno, LDAP, outra) |
| **Category** | Categoria do usuário |
| **Title** | Cargo/título |
| **Comments** | Comentários |
| **Administrative number** | Número administrativo |
| **Location** | Localização |
| **Default profile** | Perfil padrão |
| **Default entity** | Entidade padrão |
| **Default group** | Grupo padrão |
| **Supervisor** | Supervisor |

## Contact information
- **Emails** (\*) · **Phone** · **Mobile phone** · **Phone2**

## Password and access keys
- **API token** · **Password**

## Relações
- Tela: [[Ficha de Usuário (abas e visão geral)]].
- Entidade/perfil padrão ligam a [[Perfil de Usuário (conceito e composição)]] e [[Modelo de Entidades (multi-tenancy)]].
- Autenticação: [[Autenticação (Auth)]].
