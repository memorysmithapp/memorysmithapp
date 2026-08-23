---
title: Ficha de Usuário (abas e visão geral)
aliases: [Aba Users, User form, Ficha do usuário]
tags: [usuarios, ficha-usuario, abas, ldap, administracao]
type: component
status: confirmed
source: "[[EV-2-e1-001 · Ficha de Usuário — aba Users, impersonate e vcard|EV-2-e1-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Ficha de Usuário (abas e visão geral)

A **ficha de usuário** (aba *Users* em `Administration > Users`) é a tela de gestão de um usuário no GLPI: dados de identificação, autenticação, autorizações e vínculos. É o ponto onde o administrador materializa a [[Gestão de Usuários e Acesso (processo)]] descrita no código.

## Comportamentos de conta
- **Desativação**: um usuário pode ser desativado; deixa de ser selecionável em dropdowns de tickets/inventários, mas mantém itens e tickets associados.
- **Datas de validade** (`Valid since` / `Valid until`): definem a janela em que a conta é considerada ativa; podem ser definidas independentemente.
- **Foto**: adicionada manualmente ou importada automaticamente de um diretório LDAP.
- **Edição condicionada à origem**: dados de usuários importados de um provedor (LDAP, SCIM…) não podem ser editados manualmente — por exemplo, o e-mail de um usuário LDAP(S) é imutável.

## Abas da ficha
User Information · Contact information · Password and access keys · [[Atribuição de autorizações e grupos a um usuário (procedimento)|Authorizations]] · Groups · Settings · Used items · Managed items · Consumables · Created tickets · Problems · Changes · Documents · Reservations · **Synchronization** (só com direito *Update Authentication and Synchronization*) · Links · Certificates · Licenses · Contracts · Historical.

- A aba **Settings** exige direito de modificação da configuração geral; dados nela têm prioridade sobre a configuração geral do GLPI.
- A aba **Reservations** exige direito de leitura sobre reservas — ver [[Reserva de Ativos e Documentos (processos)]].
- Um ícone permite baixar o **vcard** do usuário.

## Relações
- Campos detalhados em [[Campos da ficha de Usuário]].
- Recurso de [[Personificação de usuário (Impersonate)]].
- Modelo de dados no código: [[Usuários e Grupos]].
- Autenticação e provisionamento: [[Autenticação (Auth)]], [[Fluxo de login e provisionamento]].
- Processo de administração: [[Administração de Controles de Acesso (processo)]].
