---
title: Configuração e Instalação
aliases: [Config, "Configuração (Config)", "Instalação, atualização e migrações", schema]
tags: [infra, config, instalacao, dominio/operacao]
type: infra
status: confirmed
source: "[[EV-1-039 · Plugin Config e Migration|EV-1-039]]"
author: CAD Discovery
created: 2026-07-10
---

# Configuração e Instalação

## Configuração (`Config`)
Repositório **chave/valor** de configuração global, carregado em `$CFG_GLPI` e acessível em
todo o código. Guarda parâmetros de e-mail, segurança, autenticação, a **matriz de prioridade**
([[Priorização (urgência × impacto)]]), inventário, etc. Muitos parâmetros têm variante **por
entidade** com [[Herança de configuração por entidade|herança]].

## Instalação e atualização
- **Schema base**: `install/mysql/glpi-empty.sql` (define `GLPI_SCHEMA_VERSION`).
- **Instalador**: `install/install.php` cria o banco, o superadministrador e dados-semente
  (perfis, dropdowns padrão, crontasks, notificações).
- **Atualização**: `install/update.php` + a classe **`Migration`** aplicam migrações **por
  versão** (`install/update/update_X_to_Y.php`), evoluindo o schema e migrando dados.
- **Dados-semente vs configuração do cliente**: boa parte do comportamento (perfis,
  categorias, templates, regras, notificações) nasce na instalação e é **customizada como
  dados** pelo cliente — não vive no código.

> [!note] Requisitos
> Para replicar o comportamento de uma instância, é preciso o **código** (este repo) **+** o
> **dump de configuração/dados** dela (regras, templates,