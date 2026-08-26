---
title: Notificações no GLPI (visão de configuração)
aliases: [Notificações (config), Notifications]
tags: [notificacao, capacidade, config, email, browser]
type: capability
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-001 · Visão geral e funcionamento das notificações|EV-2-f3-001]]"
  - "[[EV-2-f3-004 · Configuração de e-mail (follow-ups) global e por entidade|EV-2-f3-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Notificações no GLPI (visão de configuração)

O GLPI possui um recurso de **notificação** que envia mensagens após um evento na aplicação, aos usuários via **e-mail**, **notificações no navegador** e outros métodos expansíveis por plugins. Já vem com definições de notificação pré-definidas, utilizáveis imediatamente após habilitar as notificações.

Para habilitar: ativar **Enable followup** e então **Enable followup via email** e/ou **Browser followups**, o que exibe o menu de configurações em **Setup > Notifications**.

> [!warning] Ao adicionar novas notificações via atualização do GLPI, elas são **habilitadas por padrão**.

Do ponto de vista de configuração, uma notificação depende de: [[Definição de notificação (estrutura)]] (tipo, evento, template e destinatários), [[Template de notificação (objeto global)]] (conteúdo/formatação) e — para o canal e-mail — da [[Campos da configuração de e-mail (follow-ups)]] (servidor SMTP, remetentes, assinatura). As [[Opções de alarme por entidade]] governam alarmes de estoque/expiração que geram notificações via [[Catálogo de ações automáticas (crontasks)]].

Esta é a perspectiva de administrador da capacidade descrita no código em [[Notificações (e-mail e canais)]], cujo fluxo interno está em [[Fluxo de notificação (event → fila → envio)]].

## Ver também
- [[Fluxo de notificação por e-mail (visão do usuário)]]
- [[Modos de notificação (e-mail e navegador)]]
- [[Modelo de Entidades (multi-tenancy)]]
