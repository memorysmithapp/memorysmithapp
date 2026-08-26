---
title: Instalação e atualização de plugins (marketplace)
aliases: [Install and update plugins, Marketplace (config)]
tags: [integracao, plugin, marketplace, glpi-network, instalacao]
type: integration
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-010 · Instalação, atualização e remoção de plugins|EV-2-f3-010]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Instalação e atualização de plugins (marketplace)

Gestão de extensões (plugins) em `Setup > Plugins`. Há duas UIs: o **Marketplace** e a lista de plugins antiga (alternáveis). Se um plugin for instalado por ambos, a versão do marketplace prevalece. **Recomenda-se backup do banco antes de instalar/atualizar.**

## Marketplace
Requer chave de registro do **GLPI Network** (gratuita em services.glpi-network.com; inserida em `Setup > General > GLPI Network`). Aba **Discovery** lista todos os plugins (oficiais gratuitos/assinatura e comunitários), com filtro por categoria e busca. Plugins `GLPI NETWORK` exigem assinatura paga e indicam o tier (`BASIC`/`STANDARD`/`ADVANCED`; cada tier inclui os inferiores). Instalação baixa a versão compatível para a pasta `marketplace/`; após instalar, um **toggle** habilita o plugin. Alguns exigem configuração (ícone de chave inglesa) e aparecem no módulo correspondente. Atualização pela aba **Installed** (re-habilitar após).

## Gestão manual
Descoberta pelo **catálogo** (plugins.glpi-project.org). Extrair para a pasta `plugins/`; a pasta deve ter o **nome interno** (minúsculas, sem espaços) e conter ao menos **`hook.php`** e **`setup.php`**. Detecção automática pelo GLPI; re-habilitar após instalar/atualizar.

## Desinstalação
O *uninstall* não apaga o código (plugin fica reinstalável). Para remover de vez: apagar a pasta; surge então a ação **cleanup** que remove a referência do banco.

## Plugins e atualização do GLPI
Ver [[Suspensão de plugins na atualização do GLPI]].

Esta é a visão de configuração do sistema descrito em código como [[Plugins e Marketplace]] e [[Sistema de Plugins (Hooks)]].

> [!note] Conexão com a investigação de código [[INV-1-002 · Catálogo completo de hooks de plugin]]: este documento (perspectiva de admin) menciona apenas que um plugin precisa de `hook.php` e `setup.php`, mas **não** enumera os hooks disponíveis — logo **não responde** essa investigação.

## Ver também
- [[Comunidade e Ecossistema do GLPI]]
- [[Catálogo de ações automáticas (crontasks)]] (ação `checkAllUpdates`)
