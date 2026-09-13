---
title: Fontes de autenticação externa (configuração)
aliases: [Autenticação externa, Setup Authentication]
tags: [authentication, configuration, sso, external-auth]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-f2-001 · Processo geral de autenticação e criação on-the-fly|EV-2-f2-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Fontes de autenticação externa (configuração)

O GLPI mantém uma **base interna própria de usuários** e pode complementá-la com uma ou mais **fontes de autenticação externas**. A configuração geral fica no menu **Setup > Authentication** (Configuração > Autenticação). É a visão de administrador da nota de código [[Autenticação (Auth)]] e do processo [[Autenticação e Single Sign-On (processo)]].

## Fontes suportadas
- **LDAP directories** — ver [[Diretório LDAP e Active Directory (configuração)]]
- **Email servers (IMAP/POP)** — ver [[Autenticação por servidor de e-mail (IMAP-POP)]]
- **CAS server**, **x509 certificate** e **delegação ao servidor web / SSO** — ver [[Métodos de autenticação externos adicionais (CAS, x509, SSO delegado)]]

## Configuração geral
- **Não há limite** para o número de fontes configuradas.
- Para usar uma fonte externa pode ser necessário habilitar as extensões PHP correspondentes (ex.: `php-ldap` para LDAP).
- A **criação automática de usuários** ("on the fly") a partir das fontes externas deve ser habilitada no formulário **Setup > Authentication > Setup**.
- Com diretórios LDAP é possível **recusar a criação de usuários sem autorizações** e configurar a ação quando um usuário some do diretório (lixeira, remover permissões, desativar) e o tratamento de usuários restaurados.
- O **fuso horário** do GLPI também é definido neste nível.

> [!note]
> A atribuição de autorizações (quem realmente pode logar) é tratada pelo motor de regras de autorização — ver [[Motor de Regras de Negócio (capacidade)]] e o processo [[Processo de autenticação e login (visão do administrador)]].

Relacionadas: [[Configuração de MFA e 2FA]], [[Gestão de Usuários e Acesso (processo)]].
