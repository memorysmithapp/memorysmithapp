---
title: Acesso e Login no GLPI (fluxo)
aliases: [Login GLPI, How to connect, Acesso, Logout]
tags: [flow, login, access, session, browser, use-case]
type: flow
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-a1-003 · Navegador, conexão e fim de sessão|EV-2-a1-003]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Acesso e Login no GLPI (fluxo)

Fluxo do usuário para acessar e sair do GLPI, do ponto de vista da documentação de uso.

## Pré-requisito: navegador
GLPI requer um navegador web moderno e compatível com padrões. Suportados: **Edge**, **Firefox** (inclui as 2 últimas ESR), **Chrome**. Também funciona em mobile (versões móveis dos navegadores suportados).

## Conexão
1. Abrir o navegador e ir à homepage do GLPI (`https://{glpi_address}/`).
2. Acesso à funcionalidade completa requer **autenticação**.
3. Um usuário **não autenticado** pode, se assim configurado, acessar certas funções: abrir um ticket, consultar ativos, ver a FAQ, etc.
4. Conforme o **perfil** do usuário autenticado, é exibida a [[Interface Padrão (Standard)]] ou a [[Interface Simplificada (Helpdesk-Self-Service)]].

## Fim da sessão
Clicar no botão de logout no topo direito da tela; após o logout, o usuário é redirecionado à página de login.

> [!note]
> Este fluxo é a face de uso do mecanismo de autenticação do código: ver [[Fluxo de login e provisionamento]] e [[Autenticação (Auth)]]. A escolha de interface deriva de [[Administração de Controles de Acesso (processo)]].

## Relações
- Precedido por: [[Gestão de Senha do Usuário]], eventualmente [[Configuração de MFA e 2FA]].
- Ponte de código: [[Fluxo de login e provisionamento]], [[Autenticação (Auth)]], [[Autenticação e Single Sign-On (processo)]].
