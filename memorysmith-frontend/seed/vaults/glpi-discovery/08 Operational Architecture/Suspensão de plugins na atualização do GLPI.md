---
title: Suspensão de plugins na atualização do GLPI
aliases: [Suspend plugins, Plugins and Update GLPI]
tags: [operacao, plugin, atualizacao, suspensao, manutencao]
type: infra
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-010 · Instalação, atualização e remoção de plugins|EV-2-f3-010]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Suspensão de plugins na atualização do GLPI

Ao **atualizar o GLPI**, a execução dos plugins é **suspensa**, o que preserva o estado dos plugins antes da atualização para restaurá-lo depois.

- A execução é **retomada automaticamente** quando a atualização é apenas de **bugfix** (ex.: 11.0.x → 11.0.y).
- Deve ser retomada **manualmente** em atualizações **maiores ou intermediárias** (ex.: 11.0.x → 11.1.y ou 12.0.z).

Isso evita ter de reativar plugins um a um e evita ativar por engano um plugin que estava desativado.

A suspensão também serve como ferramenta de **diagnóstico**: se o GLPI se comporta de forma anômala, pode-se **suspender todos os plugins** (`Suspend execution of all plugins`) para verificar se a anomalia vem de um plugin, e depois `Resume execution of all active plugins`.

Relaciona-se a [[Instalação e atualização de plugins (marketplace)]] e ao sistema de código [[Sistema de Plugins (Hooks)]] / [[Plugins e Marketplace]].

## Ver também
- [[Configuração e Instalação]]
