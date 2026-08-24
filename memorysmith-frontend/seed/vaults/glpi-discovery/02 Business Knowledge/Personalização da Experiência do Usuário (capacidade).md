---
title: Personalização da Experiência do Usuário (capacidade)
aliases: [Preferências do usuário, User preferences, Personalize]
tags: [capability, preferences, personalization, ux]
type: capability
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-a1-009 · Preferências do usuário (abas e campos)|EV-2-a1-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Personalização da Experiência do Usuário (capacidade)

O GLPI oferece a cada usuário autenticado a capacidade de **modificar suas preferências**, desde que possua o direito de atualização *Personalize* em seu perfil. As preferências são acessadas pela aba *Preferences* do formulário do usuário (clicando no nome no topo direito, de qualquer página) e **sobrepõem** os valores padrão definidos na configuração geral.

A capacidade se decompõe em abas:
- **Principal (Main)** — informações pessoais (nome, e-mail, telefone, localização, idioma), e-mail padrão para notificações, perfil/entidade padrão, modo debug (usuários experientes) e chave de acesso remoto. Campos vindos de LDAP podem ser não-editáveis.
- **Autenticação de dois fatores (2FA/MFA)** — ver [[Configuração de MFA e 2FA]].
- **Personalização (Personalization)** — comportamento da interface: customização geral, customização de assistência e cores de prioridade, progressão de prazo (due date), dashboards padrão, posição de notificações e substitutos autorizados.
- **Visão Pessoal (Personal View)** — gerencia visões customizadas definidas nos objetos.

Os campos detalhados estão em [[Campos das Preferências do Usuário]].

## Relações
- Configura o comportamento de [[Visualização e Gestão de Registros]], [[Busca na Interface (uso do motor de busca)]] e das visões de [[Interface Padrão (Standard)]].
- Inclui [[Gestão de Senha do Usuário]] e [[Configuração de MFA e 2FA]].
- Ponte de código: [[Autenticação (Auth)]], [[Perfis e Direitos (RBAC)]].
