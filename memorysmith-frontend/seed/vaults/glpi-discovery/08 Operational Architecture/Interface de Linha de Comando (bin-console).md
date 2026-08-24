---
title: Interface de Linha de Comando (bin-console)
aliases: [bin/console, CLI GLPI, console]
tags: [cli, bin-console, comandos, operacional, symfony-console]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-g1-005 · Referência da linha de comando bin-console (cli.rst)|EV-2-g1-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

O GLPI inclui uma **interface de linha de comando (CLI)** para administrar a instância, fornecida pelo script **`bin/console`**, executado a partir da raiz do diretório do GLPI. É a face operacional do [[Kernel e Bootstrap]] e da [[Arquitetura de execução (request lifecycle)]] fora do contexto web — usada em instalação, atualização, manutenção, sincronização, migração e diagnóstico.

## Anatomia de um comando

- Cada comando pode ter **zero ou mais argumentos** (informações **posicionais**) e **opções** (não posicionais, prefixadas por um ou dois hífens, ex.: `-f`/`--force`).
- Muitos comandos têm **aliases** curtos (ex.: `glpi:cache:clear` também é `cache:clear`).
- Opções podem ser: **obrigatórias**, ter **default**, aceitar **array** (repetíveis) e ser **negatable**.

> [!note] Geração da referência
> A página de referência da CLI é **gerada automaticamente** pelo comando `dev:docs:generate:cli` do plugin `dev` — logo, comandos de plugins/dev podem não aparecer na lista do núcleo.

## Famílias de comandos

Os comandos documentados agrupam-se por prefixo/domínio (cada família tem sua própria nota):

- **`cache:` / `config:`** → [[Comandos de CLI - Cache e Configuração]]
- **`database:`** → [[Comandos de CLI - Banco de Dados]]
- **`migration:`** → [[Comandos de CLI - Migração de Dados]]
- **`plugin:` / `marketplace:`** → [[Comandos de CLI - Plugins e Marketplace]]
- **`maintenance:` / `system:` / `security:` / `task:`** → [[Comandos de CLI - Manutenção e Diagnóstico de Sistema]]
- **`assets:` / `build:` / `ldap:` / `rules:` / `tools:`** → [[Comandos de CLI - Regras, Ativos e Ferramentas]]

Ligações: [[Organização do código-fonte]] · [[Configuração e Instalação]] · [[Configuração Avançada do GLPI (visão geral)]]
