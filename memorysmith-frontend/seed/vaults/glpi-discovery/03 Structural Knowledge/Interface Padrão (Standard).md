---
title: Interface Padrão (Standard)
aliases: [Standard Interface, Interface standard, Central]
tags: [component, interface, standard, dashboard, home-page]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-a1-004 · Interface padrão e interface simplificada|EV-2-a1-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Interface Padrão (Standard)

A **interface padrão** é a interface principal da aplicação: todos os módulos estão disponíveis, com limites conforme as configurações do perfil. É a interface exibida a técnicos e administradores (contrasta com a [[Interface Simplificada (Helpdesk-Self-Service)]]).

A página inicial oferece uma visão-resumo de acesso rápido a elementos ativos (tickets, notas, planejamento, contratos). É dividida em **5 visões**:

| Visão | Conteúdo |
|---|---|
| **Dashboard** | Painel customizável |
| **Personal view** | Tickets em que o usuário logado é requerente (abertos, rejeitados, a processar, a aprovar) ou atua como validador/técnico (aguardando validação, em progresso, a fechar, em espera); questões correntes, agenda e notas |
| **Group view** | Mesma informação, referenciando os grupos do usuário |
| **Global view** | Estatísticas de tickets/questões por status, contratos por expiração, últimas adições; novos tickets conforme config |
| **RSS feed** | Conteúdo dos feeds RSS definidos (menu "Tools > RSS Feeds") |

> [!note]
> Nas visões Personal e Group, só são exibidas tabelas com informação. A interface padrão (default) e a visibilidade dos módulos são configuráveis nos perfis ou nas [[Campos das Preferências do Usuário|preferências]].

> [!warning] Primeiro login pós-instalação
> Podem surgir mensagens de segurança: trocar senhas das contas padrão e apagar o diretório `glpi/install`, além de mensagens sobre segurança ou mudanças de schema. Persistem até serem tratadas.

## Relações
- Alternativa a: [[Interface Simplificada (Helpdesk-Self-Service)]].
- Navegada por: [[Módulos de Navegação do GLPI]], [[Áreas da Interface do GLPI]].
- Ponte de código: [[Ticket]], [[Perfis e Direitos (RBAC)]].
