---
title: Configuração Avançada do GLPI (visão geral)
aliases: [Advanced Configuration, configuração avançada]
tags: [operacional, avancado, cache, locales, temas, status, indice]
type: overview
status: confirmed
source: "[[EV-2-g1-006 · Índices de Configuração Avançada e Módulos (index.rst)|EV-2-g1-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

A seção **Advanced Configuration** da documentação reúne os tópicos operacionais/avançados destinados a administradores que operam o GLPI em produção. Funciona como um MOC temático da operação avançada:

- **Cache** — [[Sistema de Cache do GLPI (operacional)]] e [[OPCache e otimização de PHP]]
- **Status** — [[Monitoramento de Status e Health Check]] (endpoint `/status.php` e `glpi:system:status`)
- **Override de locales** — [[Override de Locales e Traduções (gettext)]]
- **Paletas customizadas** — [[Paletas Customizadas (temas SCSS)]]

Complementarmente, a operação por linha de comando é coberta por [[Interface de Linha de Comando (bin-console)]] e suas famílias de comandos.

> [!note] Escopo
> Esta é a perspectiva de **operação e manutenção** do produto (a partir da documentação `SRC-002`), complementar às notas de código sobre [[Configuração e Instalação]], [[Arquitetura de execução (request lifecycle)]], [[Kernel e Bootstrap]] e [[Ações Automáticas (CronTask)]].

Ligações: [[Documentação do Usuário GLPI (escopo e estrutura)]] · [[Módulos de Navegação do GLPI]]
