---
title: Cartucho (ativo)
aliases: [Cartridge, Cartucho, Cartuchos]
tags: [assets, cartridge, stock, structural, doc]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-c2-009 · Cartuchos (cartridges.rst)|EV-2-c2-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Cartucho (ativo)

Funcionalidade do módulo **Assets** que permite criar **modelos de cartucho** e os cartuchos correspondentes (consumíveis de impressão). Relaciona-se ao domínio de estoque/consumíveis já mapeado no código em [[Reservas e Consumíveis]].

## Composição (abas)
- Formulário do modelo ([[Campos do formulário de Cartucho]]) com **Alert threshold** (limite de alerta) e **Stock target** (meta de estoque).
- **Cartridges**: adiciona quantos cartuchos o modelo precisar (também em lote).
- **Printer models**: permite compartilhar cartuchos entre vários modelos de impressora compatíveis.
- Abas comuns: Management, Documents, Links, Notes, Historical.

## Relações
- Comparte a lógica de estoque/limite de alerta com [[Consumível (ativo)]].
