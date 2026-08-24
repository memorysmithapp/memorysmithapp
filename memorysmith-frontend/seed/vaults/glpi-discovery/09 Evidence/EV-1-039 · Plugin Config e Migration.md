---
title: EV-1-039 · Plugin, Config e Migration
aliases: [EV-1-039]
tags: [evidence, dominio/operacao, plugin, config, instalacao]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-001 · src/Plugin.php L62 · src/Config.php L68 · src/Migration.php L49 · install/"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-039 · Plugin, Config e Migration

> [!quote] classes (grep confirmado)
> ```php
> class Plugin extends CommonDBTM { ... }   // ciclo de vida de plugin (install/activate)
> class Config extends CommonDBTM { ... }    // armazém de configuração global (chave/valor)
> class Migration { ... }                    // helper de migração de schema (install/update)
> ```

- **Plugin** — gerencia o ciclo de vida dos plugins: instalar, **ativar/desativar**, atualizar,
  desinstalar. Cada plugin registra hooks ([[Sistema de Plugins (Hooks)]]); o **Marketplace**
  baixa/atualiza plugins da loja.
- **Config** — repositório de **configuração global** (chave/valor por contexto), lido em todo
  lugar via `$CFG_GLPI`. É onde vivem a matriz de prioridade, parâmetros de e-mail, segurança,
  etc.
- **Migration** — helper usado pelo instalador/atualizador para evoluir o **schema**
  (`install/mysql/glpi-empty.sql` + migrações por versão em `install/update/`).

## Sustenta
- [[Plugins e Marketplace]]
- [[Configuração (Config)]]
- [[Instalação, atualização e migrações]]
