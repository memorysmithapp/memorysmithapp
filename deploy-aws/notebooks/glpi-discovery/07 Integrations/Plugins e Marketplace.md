---
title: Plugins e Marketplace
aliases: [Plugin, Marketplace, extensibilidade]
tags: [integration, plugins, dominio/integracoes]
type: integration
maturity: evergreen
reviewed: false
source: "[[EV-1-039 · Plugin Config e Migration|EV-1-039]]"
author: CAD Discovery
created: 2026-07-10
---

# Plugins e Marketplace

Extensibilidade empacotada. Um **Plugin** adiciona itemtypes, telas, regras e comportamentos
sem tocar no núcleo, registrando-se nos **hooks** ([[Sistema de Plugins (Hooks)]]).

- **Ciclo de vida** (`Plugin`): descoberta em `plugins/`, **instalação** (cria schema próprio),
  **ativação/desativação**, atualização e desinstalação (limpeza).
- **Marketplace** — baixa e atualiza plugins da loja oficial (requer acesso à API do
  marketplace na internet).
- Plugins vivem no namespace `GlpiPlugin\` (`NS_PLUG`).

> [!warning] Escopo da extração
> A instância-alvo pode ter plugins com **regras de negócio próprias** fora deste repositório
> (`SRC-001` = só o core). Ver [[INV-1-003 · Comportamento de produção via plugins fora do repo]].
